import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { database } from "@/storage";
import type { Task } from "@/storage/models";
import { Button, Card, CardTitle, CardDescription } from "@/components/ui";
import { LoadingScreen } from "@/components/common";
import { enqueueSync } from "@/sync";
import { formatDate } from "@/lib/date";

const statusFlow = ["todo", "in_progress", "done"] as const;

export default function TaskDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (id === undefined) return;
    void (async () => {
      const collection = database.get<Task>("tasks");
      const results = await collection.query().fetch();
      const found = results.find((t) => t.serverId === id);
      setTask(found ?? null);
    })();
  }, [id]);

  if (task === null) {
    return <LoadingScreen />;
  }

  const currentIndex = statusFlow.indexOf(
    task.status as (typeof statusFlow)[number],
  );
  const nextStatus =
    currentIndex >= 0 && currentIndex < statusFlow.length - 1
      ? statusFlow[currentIndex + 1]
      : null;

  const handleStatusUpdate = async (): Promise<void> => {
    if (nextStatus === null || nextStatus === undefined) return;
    setIsUpdating(true);
    try {
      await database.write(async () => {
        await task.update((record) => {
          record.status = nextStatus;
          record.synced = false;
        });
        await enqueueSync("tasks", task.id, "update", {});
      });
      const collection = database.get<Task>("tasks");
      const results = await collection.query().fetch();
      const updated = results.find((t) => t.serverId === id);
      setTask(updated ?? null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Update failed";
      Alert.alert("Error", msg);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView className="flex-1 px-4 pt-4">
        <Card>
          <CardTitle>{task.title}</CardTitle>
          {task.description !== "" && (
            <CardDescription>{task.description}</CardDescription>
          )}

          <View className="mt-4 gap-2">
            <View className="flex-row justify-between">
              <Text className="text-sm text-foreground/60">Status</Text>
              <Text className="text-sm font-medium text-foreground">
                {task.status}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-foreground/60">Priority</Text>
              <Text className="text-sm font-medium text-foreground">
                {task.priority}
              </Text>
            </View>
            {task.dueDate !== null && (
              <View className="flex-row justify-between">
                <Text className="text-sm text-foreground/60">Due date</Text>
                <Text className="text-sm font-medium text-foreground">
                  {formatDate(task.dueDate)}
                </Text>
              </View>
            )}
            {!task.synced && (
              <Text className="mt-1 text-xs text-primary">Pending sync</Text>
            )}
          </View>
        </Card>

        {nextStatus !== null && nextStatus !== undefined && (
          <View className="mt-4">
            <Button
              title={`Move to ${nextStatus.replace("_", " ")}`}
              onPress={() => void handleStatusUpdate()}
              isLoading={isUpdating}
            />
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
