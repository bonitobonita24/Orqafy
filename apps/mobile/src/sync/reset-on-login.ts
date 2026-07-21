import { type Model } from "@nozbe/watermelondb";

import { database } from "@/storage";
import {
  decodeJwtUserId,
  getStoredToken,
  getStoredUserId,
  setStoredUserId,
} from "@/lib/auth";
import { decideReset } from "@/sync/reset-decision";

/**
 * Prevents financial/task PII from surviving a user switch on a shared
 * device. WatermelonDB has no per-row access control — the mobile app has a
 * single local database, and until this check existed nothing ever cleared
 * it, so worker B logging into a handset worker A just used could read A's
 * synced payslips and tasks straight off disk.
 *
 * MUST run at LOGIN, never at logout: a worker who signs out and back in as
 * THEMSELVES must keep their queued (not-yet-pushed) offline edits, so the
 * decision to wipe can only be made once we know who is logging in next.
 *
 * Call this BEFORE persisting the new session (saveSession) so the "previous
 * user" read below (both the stored userId AND the stored auth token) still
 * reflects who was signed in prior to this login.
 *
 * storedUserId is null on TWO very different installs: a true fresh install
 * (nothing to protect) and an EXISTING install upgrading past the release
 * that introduced the stored-userId key (the worker may well have unsynced
 * offline work that must survive). To tell these apart we fall back to the
 * userId claim of whatever auth token that existing install still has on
 * disk from its prior login — see decodeJwtUserId's doc comment for why this
 * unverified read is safe to use for a wipe decision but nowhere else.
 */
export async function resetLocalDatabaseIfUserChanged(
  newUserId: string,
): Promise<void> {
  const storedUserId = await getStoredUserId();

  let tokenUserId: string | null = null;
  if (storedUserId === null) {
    const existingToken = await getStoredToken();
    tokenUserId = existingToken === null ? null : decodeJwtUserId(existingToken);
  }

  const shouldWipe = decideReset({
    newUserId,
    storedUserId,
    tokenUserId,
    hasLocalRows: await hasAnyLocalRows(),
  });

  if (shouldWipe) {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  }

  await setStoredUserId(newUserId);
}

// Every down-synced or mobile-originated table — a wipe destroys all of
// them together (unsafeResetDatabase has no per-table granularity), so this
// only needs to know whether ANY of them currently holds data.
const LOCAL_TABLES = [
  "tasks",
  "payslips",
  "dtr_entries",
  "expenses",
  "sync_queue",
] as const;

async function hasAnyLocalRows(): Promise<boolean> {
  const counts = await Promise.all(
    LOCAL_TABLES.map((table) => database.get<Model>(table).query().fetchCount()),
  );
  return counts.some((count) => count > 0);
}
