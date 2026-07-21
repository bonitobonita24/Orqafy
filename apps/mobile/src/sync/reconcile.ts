/**
 * Pure full-replace reconciliation planner for the down-sync (pull).
 *
 * Deliberately dependency-free — no react-native, no watermelondb — so it is
 * unit-testable under plain Vitest. It DECIDES what should happen; applying the
 * plan to the database is the caller's job (pull.ts). That split matters: a bug
 * here can permanently destroy a worker's local rows.
 *
 * Governing rule (spec §3):
 *   Up-sync owns rows with pending local writes. The server owns everything else.
 */

export interface ReconcileOptions<S, L> {
  /** Extract the server-side id from a server row. */
  serverKey: (row: S) => string;
  /** Extract the server-side id from a local row. */
  localKey: (row: L) => string;
  /**
   * True when the local row has an edit that has not yet been pushed. Such rows
   * are never overwritten and never destroyed.
   *   tasks    → (row) => row.synced === false
   *   payslips → () => false   (phone never writes payslips)
   */
  hasPendingWrites: (row: L) => boolean;
}

export interface ReconcilePlan<S, L> {
  toCreate: S[];
  toUpdate: Array<{ local: L; server: S }>;
  toDestroy: L[];
  skipped: L[];
}

export function reconcile<S, L>(
  serverRows: S[],
  localRows: L[],
  { serverKey, localKey, hasPendingWrites }: ReconcileOptions<S, L>,
): ReconcilePlan<S, L> {
  const plan: ReconcilePlan<S, L> = {
    toCreate: [],
    toUpdate: [],
    toDestroy: [],
    skipped: [],
  };

  // Group local rows by key — duplicates can occur when local data drifted.
  // The FIRST row per key is the reconcile counterpart; any extras are
  // destroyed below (unless they hold pending writes).
  const localByKey = new Map<string, L[]>();
  for (const local of localRows) {
    const key = localKey(local);
    const bucket = localByKey.get(key);
    if (bucket === undefined) {
      localByKey.set(key, [local]);
    } else {
      bucket.push(local);
    }
  }

  const seenKeys = new Set<string>();

  for (const server of serverRows) {
    const key = serverKey(server);
    if (seenKeys.has(key)) continue; // duplicate server row — first occurrence wins
    seenKeys.add(key);
    const local = localByKey.get(key)?.[0];

    if (local === undefined) {
      plan.toCreate.push(server);
    } else if (hasPendingWrites(local)) {
      // Pending up-sync wins — leave it alone until its queued op lands.
      plan.skipped.push(local);
    } else {
      plan.toUpdate.push({ local, server });
    }
  }

  for (const [key, locals] of localByKey) {
    const onServer = seenKeys.has(key);
    // First entry was already reconciled above (create/update/skip target).
    // Any additional entries sharing this key are orphaned duplicates —
    // destroy them UNLESS they hold unpushed work.
    const extras = onServer ? locals.slice(1) : locals;
    for (const local of extras) {
      if (hasPendingWrites(local)) continue;
      plan.toDestroy.push(local);
    }
  }

  return plan;
}

/**
 * Validates a pull response before any reconciliation happens.
 *
 * This is the single most safety-critical guard in the down-sync: under
 * full-replace semantics, a malformed body silently read as "zero records"
 * would destroy every local row. Throwing here aborts the pull and leaves local
 * data untouched. Lives in this dependency-free module so it stays testable.
 */
export function assertRecords<T>(
  body: unknown,
  isValidElement?: (element: unknown) => boolean,
): T[] {
  if (body === null || typeof body !== "object" || !("records" in body) || !Array.isArray(body.records)) {
    throw new Error("pull: malformed response body");
  }
  if (isValidElement !== undefined) {
    for (const element of body.records) {
      if (!isValidElement(element)) {
        throw new Error("pull: malformed response body — record failed shape validation");
      }
    }
  }
  return body.records as T[];
}

// ── Element-shape validators for assertRecords() ───────────────────────────
//
// Cover every field pull.ts's prepareCreate/prepareUpdate assign onto the
// local models — a record missing (or wrong-typed on) any of these would
// otherwise be written with `undefined` into that column. Live here (rather
// than in pull.ts, which imports WatermelonDB) so they run under plain
// Vitest — this is the ONLY thing standing between a server-side field-name
// typo and a silent bad write on the only permanently-destructive code path
// in the app (see assertRecords doc comment above).

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

export function isValidPulledTask(element: unknown): boolean {
  if (element === null || typeof element !== "object") return false;
  const record = element as Record<string, unknown>;
  return (
    isNonEmptyString(record.server_id) &&
    isString(record.tenant_id) &&
    isString(record.title) &&
    isString(record.status) &&
    isString(record.priority) &&
    isStringOrNull(record.description) &&
    isStringOrNull(record.project_id) &&
    isString(record.assigned_to) &&
    isNumberOrNull(record.due_date)
  );
}

export function isValidPulledPayslip(element: unknown): boolean {
  if (element === null || typeof element !== "object") return false;
  const record = element as Record<string, unknown>;
  return (
    isNonEmptyString(record.server_id) &&
    isString(record.tenant_id) &&
    isString(record.user_id) &&
    isNumber(record.period_start) &&
    isNumber(record.period_end) &&
    isNumber(record.gross_pay) &&
    isNumber(record.net_pay) &&
    isString(record.deductions)
  );
}

/**
 * Concurrency guard shared by every pull entry point (pullAll AND the
 * individual pullTasks/pullPayslips exports) so a screen calling pullTasks()
 * directly cannot race an in-flight pullAll() for the same entity.
 *
 * Lives in this dependency-free module (rather than pull.ts, which imports
 * WatermelonDB) so it is unit-testable under plain Vitest — this is exactly
 * the kind of state-machine logic that is easy to get subtly wrong.
 *
 * `current` is always reset in `finally` so a throw can never wedge it
 * permanently, and `promise` is cleared alongside it so a stale settled
 * promise is never handed to a later caller.
 */
export interface GuardState {
  current: boolean;
  promise: Promise<void> | null;
}

export function createGuardState(): GuardState {
  return { current: false, promise: null };
}

/**
 * Runs `fn` under the guard. If a call is already in flight, this does NOT
 * start a second run — it returns the SAME in-flight promise, so a caller
 * (e.g. a pull-to-refresh spinner) awaits the real completion instead of
 * resolving immediately while work is still happening underneath it.
 *
 * Safe under concurrent (synchronous, non-awaited) callers: `state.current`
 * is set before any `await` occurs, so a second call landing in the same
 * synchronous tick still observes the guard as active.
 */
export function runGuarded(
  state: GuardState,
  fn: () => Promise<void>,
): Promise<void> {
  if (state.current) {
    return state.promise ?? Promise.resolve();
  }
  state.current = true;
  const promise = (async () => {
    try {
      await fn();
    } finally {
      state.current = false;
      state.promise = null;
    }
  })();
  state.promise = promise;
  return promise;
}
