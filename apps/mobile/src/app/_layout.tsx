import { useEffect } from "react";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/api";
import { setupNotificationListeners } from "@/notifications";
import { startAutoSync, stopAutoSync } from "@/sync";
import "../global.css";

export default function RootLayout(): React.JSX.Element {
  useEffect(() => {
    const cleanupNotifications = setupNotificationListeners();
    startAutoSync();

    return () => {
      cleanupNotifications();
      stopAutoSync();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Slot />
    </QueryClientProvider>
  );
}
