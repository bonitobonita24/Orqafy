import NetInfo from "@react-native-community/netinfo";
import { AppState, type AppStateStatus } from "react-native";
import { processQueue } from "./queue";
import { pullAll } from "./pull";
import { SYNC_INTERVAL_MS } from "@/constants";

let syncTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;

/**
 * One sync cycle: push pending local edits FIRST, then adopt server truth.
 * Ordering matters — pushing first means fewer rows are skipped by the pull's
 * pending-writes guard, so the phone converges in one cycle instead of two.
 */
async function runSyncCycle(): Promise<void> {
  const netState = await NetInfo.fetch();
  if (netState.isConnected !== true) return;

  try {
    await processQueue();
  } catch {
    // Silent fail — will retry on next interval
  }

  try {
    await pullAll();
  } catch {
    // Non-fatal: local data is left untouched, retry next interval
  }
}

export function startAutoSync(): void {
  if (syncTimer !== null) return;

  syncTimer = setInterval(() => {
    void runSyncCycle();
  }, SYNC_INTERVAL_MS);

  // Returning to the app should show current data without waiting for a tick.
  appStateSub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") {
      void runSyncCycle();
    }
  });
}

export function stopAutoSync(): void {
  if (syncTimer !== null) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  if (appStateSub !== null) {
    appStateSub.remove();
    appStateSub = null;
  }
}
