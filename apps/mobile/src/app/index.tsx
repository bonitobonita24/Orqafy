import { useEffect } from "react";
import { router } from "expo-router";
import { isAuthenticated } from "@/lib/auth";
import { LoadingScreen } from "@/components/common";

export default function IndexScreen(): React.JSX.Element {
  useEffect(() => {
    void isAuthenticated().then((authenticated) => {
      if (authenticated) {
        router.replace("/(app)/");
      } else {
        router.replace("/(auth)/login");
      }
    });
  }, []);

  return <LoadingScreen />;
}
