import { Stack } from "expo-router";

export default function TasksLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#050507" },
        headerTintColor: "#E8E8ED",
        headerTitleStyle: { fontWeight: "600" },
      }}
    />
  );
}
