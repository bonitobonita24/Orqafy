import { useEffect } from "react";
import { router } from "expo-router";
import { isAuthenticated } from "@/lib/auth";
import { unlockWithBiometrics } from "@/lib/biometric";
import { LoadingScreen } from "@/components/common";

export default function IndexScreen(): React.JSX.Element {
  useEffect(() => {
    void (async () => {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        router.replace("/(auth)/login");
        return;
      }

      // A token pair already exists — gate entry with a biometric unlock
      // (Face ID / fingerprint), not a second credentials login.
      const unlocked = await unlockWithBiometrics();
      router.replace(unlocked ? "/(app)/" : "/(auth)/login");
    })();
  }, []);

  return <LoadingScreen />;
}
