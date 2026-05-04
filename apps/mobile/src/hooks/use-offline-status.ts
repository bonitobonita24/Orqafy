import { useState, useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";

interface OfflineStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>({
    isConnected: true,
    isInternetReachable: null,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setStatus({
        isConnected: state.isConnected === true,
        isInternetReachable: state.isInternetReachable,
      });
    });
    return () => unsubscribe();
  }, []);

  return status;
}
