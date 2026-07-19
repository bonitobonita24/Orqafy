import { Stack } from "expo-router";

export default function TasksLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#fafafa",
        headerTitleStyle: { fontWeight: "600" },
      }}
    />
  );
}
