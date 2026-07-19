import { View, ActivityIndicator } from "react-native";

export function LoadingScreen(): React.JSX.Element {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#fafafa" />
    </View>
  );
}
