import NetInfo from "@react-native-community/netinfo";
import { processQueue } from "./queue";
import { SYNC_INTERVAL_MS } from "@/constants";

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(): void {
  if (syncTimer !== null) return;

  syncTimer = setInterval(() => {
    void (async () => {
      const netState = await NetInfo.fetch();
      if (netState.isConnected !== true) return;

      try {
        await processQueue();
      } catch {
        // Silent fail — will retry on next interval
      }
    })();
  }, SYNC_INTERVAL_MS);
}

export function stopAutoSync(): void {
  if (syncTimer !== null) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
