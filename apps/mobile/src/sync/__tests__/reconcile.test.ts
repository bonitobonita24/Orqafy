import { describe, it, expect, vi } from "vitest";
import {
  reconcile,
  assertRecords,
  createGuardState,
  runGuarded,
  isValidPulledTask,
  isValidPulledPayslip,
} from "../reconcile";

interface ServerRow {
  server_id: string;
  title: string;
}
interface LocalRow {
  serverId: string;
  title: string;
  synced: boolean;
}

const opts = {
  serverKey: (r: ServerRow) => r.server_id,
  localKey: (r: LocalRow) => r.serverId,
  hasPendingWrites: (r: LocalRow) => !r.synced,
};

describe("reconcile", () => {
  it("creates server rows that have no local counterpart", () => {
    const plan = reconcile<ServerRow, LocalRow>(
      [{ server_id: "a", title: "A" }],
      [],
      opts,
    );
    expect(plan.toCreate).toEqual([{ server_id: "a", title: "A" }]);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDestroy).toHaveLength(0);
  });

  it("updates rows present both locally and on the server", () => {
    const local = { serverId: "a", title: "old", synced: true };
    const plan = reconcile<ServerRow, LocalRow>(
      [{ server_id: "a", title: "new" }],
      [local],
      opts,
    );
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toEqual([{ local, server: { server_id: "a", title: "new" } }]);
  });

  it("destroys synced local rows the server no longer returns", () => {
    const gone = { serverId: "gone", title: "Reassigned away", synced: true };
    const plan = reconcile<ServerRow, LocalRow>([], [gone], opts);
    expect(plan.toDestroy).toEqual([gone]);
  });

  it("SKIPS a server row whose local counterpart has pending writes", () => {
    const pending = { serverId: "a", title: "in_progress locally", synced: false };
    const plan = reconcile<ServerRow, LocalRow>(
      [{ server_id: "a", title: "todo on server" }],
      [pending],
      opts,
    );
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.skipped).toEqual([pending]);
  });

  it("NEVER destroys a local row with pending writes, even if absent from the server", () => {
    const pendingOnly = { serverId: "a", title: "unsynced work", synced: false };
    const plan = reconcile<ServerRow, LocalRow>([], [pendingOnly], opts);
    expect(plan.toDestroy).toHaveLength(0);
  });

  it("treats every row as server-wins when hasPendingWrites is always false (payslips)", () => {
    const local = { serverId: "a", title: "old", synced: false };
    const plan = reconcile<ServerRow, LocalRow>(
      [{ server_id: "a", title: "new" }],
      [local],
      { ...opts, hasPendingWrites: () => false },
    );
    expect(plan.skipped).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(1);
  });

  it("produces an empty plan for empty input on both sides", () => {
    const plan = reconcile<ServerRow, LocalRow>([], [], opts);
    expect(plan).toEqual({ toCreate: [], toUpdate: [], toDestroy: [], skipped: [] });
  });

  it("produces a mixed plan — create, update, destroy, and skip in one pass", () => {
    const toUpdateLocal = { serverId: "a", title: "old", synced: true };
    const toSkipLocal = { serverId: "b", title: "in progress", synced: false };
    const toDestroyLocal = { serverId: "gone", title: "reassigned away", synced: true };
    const plan = reconcile<ServerRow, LocalRow>(
      [
        { server_id: "a", title: "new" },
        { server_id: "b", title: "server version" },
        { server_id: "c", title: "brand new" },
      ],
      [toUpdateLocal, toSkipLocal, toDestroyLocal],
      opts,
    );
    expect(plan.toCreate).toEqual([{ server_id: "c", title: "brand new" }]);
    expect(plan.toUpdate).toEqual([
      { local: toUpdateLocal, server: { server_id: "a", title: "new" } },
    ]);
    expect(plan.skipped).toEqual([toSkipLocal]);
    expect(plan.toDestroy).toEqual([toDestroyLocal]);
  });

  it("collapses duplicate server ids into exactly one create", () => {
    const plan = reconcile<ServerRow, LocalRow>(
      [
        { server_id: "a", title: "first" },
        { server_id: "a", title: "duplicate" },
      ],
      [],
      opts,
    );
    expect(plan.toCreate).toEqual([{ server_id: "a", title: "first" }]);
  });

  it("destroys an extra duplicate local row sharing a serverId, once clean", () => {
    const primary = { serverId: "a", title: "primary", synced: true };
    const duplicate = { serverId: "a", title: "duplicate", synced: true };
    const plan = reconcile<ServerRow, LocalRow>(
      [{ server_id: "a", title: "server version" }],
      [primary, duplicate],
      opts,
    );
    expect(plan.toUpdate).toEqual([
      { local: primary, server: { server_id: "a", title: "server version" } },
    ]);
    expect(plan.toDestroy).toEqual([duplicate]);
  });

  it("never destroys a duplicate local row that has pending writes", () => {
    const primary = { serverId: "a", title: "primary", synced: true };
    const duplicateWithPendingWrites = { serverId: "a", title: "duplicate", synced: false };
    const plan = reconcile<ServerRow, LocalRow>(
      [{ server_id: "a", title: "server version" }],
      [primary, duplicateWithPendingWrites],
      opts,
    );
    expect(plan.toDestroy).toHaveLength(0);
  });
});

describe("assertRecords", () => {
  it("returns the records array from a well-formed body", () => {
    expect(assertRecords({ records: [{ a: 1 }], serverTime: "x" })).toEqual([{ a: 1 }]);
  });

  it("accepts a legitimately empty record set", () => {
    expect(assertRecords({ records: [], serverTime: "x" })).toEqual([]);
  });

  // These are the cases that would otherwise wipe the local table under
  // full-replace semantics: a malformed body must NEVER read as "no records".
  it("throws on a null body", () => {
    expect(() => assertRecords(null)).toThrow(/malformed/);
  });

  it("throws on an undefined body", () => {
    expect(() => assertRecords(undefined)).toThrow(/malformed/);
  });

  it("throws when records is missing", () => {
    expect(() => assertRecords({ serverTime: "x" })).toThrow(/malformed/);
  });

  it("throws when records is not an array", () => {
    expect(() => assertRecords({ records: "nope", serverTime: "x" })).toThrow(/malformed/);
  });

  it("throws on a primitive body", () => {
    expect(() => assertRecords(42)).toThrow(/malformed/);
    expect(() => assertRecords("not an object")).toThrow(/malformed/);
  });

  it("throws on an array body", () => {
    expect(() => assertRecords([{ a: 1 }])).toThrow(/malformed/);
  });
});

describe("assertRecords — element-level validation", () => {
  interface Row {
    server_id: string;
  }
  const hasServerId = (element: unknown): boolean =>
    element !== null &&
    typeof element === "object" &&
    typeof (element as Record<string, unknown>).server_id === "string" &&
    (element as Record<string, unknown>).server_id !== "";

  it("rejects a null element", () => {
    expect(() =>
      assertRecords<Row>({ records: [null], serverTime: "x" }, hasServerId),
    ).toThrow(/malformed/);
  });

  it("rejects an element missing the id field", () => {
    expect(() =>
      assertRecords<Row>({ records: [{ title: "no id" }], serverTime: "x" }, hasServerId),
    ).toThrow(/malformed/);
  });

  it("rejects an element whose id is an empty string", () => {
    expect(() =>
      assertRecords<Row>({ records: [{ server_id: "" }], serverTime: "x" }, hasServerId),
    ).toThrow(/malformed/);
  });

  it("accepts a well-formed element set", () => {
    const result = assertRecords<Row>(
      { records: [{ server_id: "a" }, { server_id: "b" }], serverTime: "x" },
      hasServerId,
    );
    expect(result).toEqual([{ server_id: "a" }, { server_id: "b" }]);
  });

  it("preserves the old permissive behavior when the predicate is omitted", () => {
    const result = assertRecords<unknown>({ records: [null, { title: "no id" }], serverTime: "x" });
    expect(result).toEqual([null, { title: "no id" }]);
  });

  it("rejects a bad element at a non-first index (checks every element, not just the first)", () => {
    expect(() =>
      assertRecords<Row>(
        { records: [{ server_id: "a" }, null], serverTime: "x" },
        hasServerId,
      ),
    ).toThrow(/malformed/);
  });
});

// These are the REAL production validators (exported from reconcile.ts and
// imported into pull.ts) — not hand-written stand-ins. They are the only
// thing standing between a server-side field-name typo and a silent bad
// write on the down-sync's full-replace path.
describe("isValidPulledTask", () => {
  const validTask = {
    server_id: "task-1",
    tenant_id: "tenant-1",
    title: "Fix the pump",
    description: null,
    status: "todo",
    priority: "high",
    assigned_to: "user-1",
    due_date: null,
    project_id: null,
    created_at: 0,
    updated_at: 0,
    synced: true,
  };

  it("rejects a null element", () => {
    expect(isValidPulledTask(null)).toBe(false);
  });

  it("rejects an element missing a required field", () => {
    const { title: _title, ...rest } = validTask;
    expect(isValidPulledTask(rest)).toBe(false);
  });

  it("rejects an element with a wrong field type", () => {
    expect(isValidPulledTask({ ...validTask, due_date: "not-a-number" })).toBe(false);
  });

  it("accepts a fully well-formed element", () => {
    expect(isValidPulledTask(validTask)).toBe(true);
  });
});

describe("isValidPulledPayslip", () => {
  const validPayslip = {
    server_id: "slip-1",
    tenant_id: "tenant-1",
    user_id: "user-1",
    period_start: 0,
    period_end: 0,
    gross_pay: 50000,
    net_pay: 42000,
    deductions: "8000.00",
    created_at: 0,
    updated_at: 0,
  };

  it("rejects a null element", () => {
    expect(isValidPulledPayslip(null)).toBe(false);
  });

  it("rejects an element missing a required field", () => {
    const { user_id: _userId, ...rest } = validPayslip;
    expect(isValidPulledPayslip(rest)).toBe(false);
  });

  it("rejects an element with a wrong field type", () => {
    expect(isValidPulledPayslip({ ...validPayslip, gross_pay: "50000" })).toBe(false);
  });

  it("accepts a fully well-formed element", () => {
    expect(isValidPulledPayslip(validPayslip)).toBe(true);
  });
});

describe("runGuarded", () => {
  function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
  } {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it("does not run the work function again while a call is already in flight", async () => {
    const state = createGuardState();
    const gate = deferred<void>();
    const fn = vi.fn(() => gate.promise);

    const first = runGuarded(state, fn);
    const second = runGuarded(state, fn); // lands while `first` is still pending

    gate.resolve();
    await first;
    await second;

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("returns the SAME in-flight promise to a caller that lands while work is running", async () => {
    const state = createGuardState();
    const gate = deferred<void>();
    const fn = vi.fn(() => gate.promise);

    const first = runGuarded(state, fn);
    const second = runGuarded(state, fn);

    // The skipped caller must await real completion, not resolve early —
    // this assertion alone would still be racy without object identity, so
    // also assert the two promises resolve at the same tick as each other.
    expect(second).toBe(first);

    gate.resolve();
    await Promise.all([first, second]);
  });

  it("resets the flag after the work function throws — a later call runs normally", async () => {
    const state = createGuardState();
    const failing = vi.fn(() => Promise.reject(new Error("boom")));
    const succeeding = vi.fn(() => Promise.resolve());

    await expect(runGuarded(state, failing)).rejects.toThrow("boom");
    expect(state.current).toBe(false);

    await runGuarded(state, succeeding);
    expect(succeeding).toHaveBeenCalledTimes(1);
  });

  it("resets the flag after success, allowing a subsequent call to run", async () => {
    const state = createGuardState();
    const fn = vi.fn(() => Promise.resolve());

    await runGuarded(state, fn);
    expect(state.current).toBe(false);

    await runGuarded(state, fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not corrupt flag state across concurrent (synchronous) callers", async () => {
    const state = createGuardState();
    const gate = deferred<void>();
    const fn = vi.fn(() => gate.promise);

    // Three synchronous, non-awaited calls landing in the same tick.
    const calls = [
      runGuarded(state, fn),
      runGuarded(state, fn),
      runGuarded(state, fn),
    ];
    expect(state.current).toBe(true);

    gate.resolve();
    await Promise.all(calls);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(state.current).toBe(false);
    expect(state.promise).toBeNull();
  });
});
