/**
 * Pure decision logic for the login-time local-database wipe check
 * (see reset-on-login.ts). Deliberately dependency-free — no react-native,
 * no watermelondb, no expo-secure-store — so it is unit-testable under plain
 * Vitest. It only DECIDES whether to wipe; performing the wipe (and gathering
 * its inputs from SecureStore / the JWT / WatermelonDB) is the caller's job.
 *
 * Governing rule: a returning SAME user must never lose their queued
 * (not-yet-pushed) offline edits. Only a genuine user switch on a shared
 * device may destroy local data.
 */

export interface DecideResetInput {
  /** The userId that just completed authentication. */
  newUserId: string;
  /**
   * The userId stored on-device from the previous successful login, or null
   * if this key has never been written (fresh install, OR an existing
   * install that predates this key being introduced).
   */
  storedUserId: string | null;
  /**
   * The userId recovered from a pre-existing auth token (if one was found
   * and successfully decoded), used ONLY to disambiguate the storedUserId
   * === null case. Pass null when no token was found or it could not be
   * decoded.
   */
  tokenUserId: string | null;
  /** True if any local table currently holds rows. */
  hasLocalRows: boolean;
}

export function decideReset({
  newUserId,
  storedUserId,
  tokenUserId,
  hasLocalRows,
}: DecideResetInput): boolean {
  if (storedUserId !== null) {
    // Normal case: we know exactly who was signed in before.
    return storedUserId !== newUserId;
  }

  // storedUserId === null: either a fresh install (nothing to protect) or an
  // existing install upgrading past the point this key was introduced (the
  // worker HAS unsynced work that must not be destroyed). Use the pre-existing
  // auth token, if any, to tell these two cases apart.
  if (tokenUserId !== null) {
    // A token exists and decoded successfully — this is the upgrade path.
    // Same user re-authenticating -> never wipe. Different user -> wipe.
    return tokenUserId !== newUserId;
  }

  // No usable token. Either a true fresh install (nothing local, nothing to
  // protect — falls through to "do not wipe") or an existing install whose
  // token was missing/undecodable, in which case fall back to the original
  // conservative heuristic: wipe only if local rows exist. This deliberately
  // mirrors the pre-Finding-1 behavior for the case we truly cannot
  // disambiguate — undecodable-token installs are treated as unknown-identity,
  // same as a totally unknown previous user.
  return hasLocalRows;
}
