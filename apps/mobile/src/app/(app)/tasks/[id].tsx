import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { database } from "@/storage";
import type { Task } from "@/storage/models";
import { Button, Card, CardTitle, CardDescription } from "@/components/ui";
import { LoadingScreen } from "@/components/common";
import { prepareSyncQueueItem } from "@/sync";
import { formatDate } from "@/lib/date";

// Must be a subsequence of valid direct transitions in
// TASK_STATUS_TRANSITIONS (server/trpc/routers/tasks.ts) — the server
// rejects any transition not in that state machine with a 400. Notably,
// in_progress -> done is NOT a valid direct transition (only "review",
// "blocked", "todo" are); "review" is included here so the mobile
// "move to next status" button never produces an invalid jump.
const statusFlow = ["todo", "in_progress", "review", "done"] as const;

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
        // Tasks are pull-first — server/sync/handlers/tasks.ts treats the
        // sync `entityId` as the REAL server Task id (`task.serverId`), NOT
        // the local WatermelonDB `id` (they differ; see storage/schema.ts).
        // Payload must match updateStatusSchema exactly ({ status }).
        await database.batch(
          task.prepareUpdate((record) => {
            record.status = nextStatus;
            record.synced = false;
          }),
          prepareSyncQueueItem("tasks", task.serverId, "update", {
            status: nextStatus,
          }),
        );
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
