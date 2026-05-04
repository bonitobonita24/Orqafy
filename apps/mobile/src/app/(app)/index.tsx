import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Card, CardTitle, CardDescription, Button } from "@/components/ui";
import { useOfflineStatus } from "@/hooks";

export default function HomeScreen(): React.JSX.Element {
  const { isConnected } = useOfflineStatus();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView className="flex-1 px-4 pt-4">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground">Dashboard</Text>
          <Text className="mt-1 text-sm text-foreground/60">
            {isConnected ? "Connected" : "Offline mode"}
          </Text>
        </View>

        <View className="gap-4">
          <Card>
            <CardTitle>Daily Time Record</CardTitle>
            <CardDescription>Clock in/out with GPS verification</CardDescription>
            <View className="mt-3">
              <Button
                title="Open DTR"
                variant="secondary"
                onPress={() => router.push("/(app)/dtr/")}
              />
            </View>
          </Card>

          <Card>
            <CardTitle>My Tasks</CardTitle>
            <CardDescription>View and update assigned tasks</CardDescription>
            <View className="mt-3">
              <Button
                title="View Tasks"
                variant="secondary"
                onPress={() => router.push("/(app)/tasks/")}
              />
            </View>
          </Card>

          <Card>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>Submit and track expense reports</CardDescription>
            <View className="mt-3">
              <Button
                title="View Expenses"
                variant="secondary"
                onPress={() => router.push("/(app)/expenses/")}
              />
            </View>
          </Card>

          <Card>
            <CardTitle>Payslips</CardTitle>
            <CardDescription>View your payslip history</CardDescription>
            <View className="mt-3">
              <Button
                title="View Payslips"
                variant="secondary"
                onPress={() => router.push("/(app)/payslips/")}
              />
            </View>
          </Card>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
