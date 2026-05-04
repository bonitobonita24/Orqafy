import { View, Text } from "react-native";
import { useOfflineStatus } from "@/hooks";

export function OfflineBanner(): React.JSX.Element | null {
  const { isConnected } = useOfflineStatus();

  if (isConnected) {
    return null;
  }

  return (
    <View className="bg-destructive/90 px-4 py-2">
      <Text className="text-center text-sm font-medium text-white">
        You are offline. Changes will sync when reconnected.
      </Text>
    </View>
  );
}
