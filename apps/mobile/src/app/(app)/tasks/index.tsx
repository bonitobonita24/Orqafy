import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Q } from "@nozbe/watermelondb";
import { database } from "@/storage";
import type { Task } from "@/storage/models";
import { Card, CardTitle, CardDescription } from "@/components/ui";
import { EmptyState } from "@/components/common";
import { getStoredUserId } from "@/lib/auth";
import { pullAll } from "@/sync";

const priorityColors: Record<string, string> = {
  high: "text-destructive",
  medium: "text-primary",
  low: "text-foreground/40",
};

export default function TasksScreen(): React.JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = useCallback(async () => {
    // Defence in depth: the local table is full-replaced by whichever user
    // is currently logged in (reset-on-login.ts wipes it on a user switch),
    // but this filter means even a residual/unwiped row from a prior user
    // can never render on screen.
    const userId = await getStoredUserId();
    if (userId === null) {
      setTasks([]);
      return;
    }
    const collection = database.get<Task>("tasks");
    const all = await collection.query(Q.where("assigned_to", userId)).fetch();
    const sorted = all.sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });
    setTasks(sorted);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await pullAll();
      await loadTasks();
    } finally {
      setRefreshing(false);
    }
  }, [loadTasks]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  if (tasks.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
        >
          <EmptyState
            title="No tasks yet"
            description="Tasks assigned to you will appear here."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <Text className="mb-4 text-2xl font-bold text-foreground">Tasks</Text>

        <View className="gap-3">
          {tasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => {
                if (task.serverId !== null) {
                  router.push(`/(app)/tasks/${task.serverId}`);
                }
              }}
            >
              <Card>
                <View className="flex-row items-center justify-between">
                  <CardTitle>{task.title}</CardTitle>
                  <Text
                    className={`text-xs font-semibold uppercase ${priorityColors[task.priority] ?? "text-foreground/40"}`}
                  >
                    {task.priority}
                  </Text>
                </View>
                {task.description !== "" && (
                  <CardDescription>{task.description}</CardDescription>
                )}
                <View className="mt-2 flex-row items-center gap-2">
                  <View className="rounded-full bg-muted px-2.5 py-0.5">
                    <Text className="text-xs text-foreground/60">
                      {task.status}
                    </Text>
                  </View>
                  {!task.synced && (
                    <Text className="text-xs text-primary">Pending sync</Text>
                  )}
                </View>
              </Card>
            </Pressable>
          ))}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
