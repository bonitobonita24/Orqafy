import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { database } from "@/storage";
import { Expense } from "@/storage/models";
import { Button, Card, CardTitle } from "@/components/ui";
import { EmptyState } from "@/components/common";
import { formatDate } from "@/lib/date";

export default function ExpensesScreen(): React.JSX.Element {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const loadExpenses = useCallback(async () => {
    const collection = database.get<Expense>("expenses");
    const all = await collection.query().fetch();
    const sorted = all.sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );
    setExpenses(sorted);
  }, []);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView className="flex-1 px-4 pt-4">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">Expenses</Text>
          <Button
            title="+ New"
            variant="secondary"
            onPress={() => router.push("/(app)/expenses/new")}
          />
        </View>

        {expenses.length === 0 ? (
          <EmptyState
            title="No expenses"
            description="Tap + New to submit an expense report."
          />
        ) : (
          <View className="gap-3">
            {expenses.map((expense) => (
              <Card key={expense.id}>
                <View className="flex-row items-center justify-between">
                  <CardTitle>{expense.category}</CardTitle>
                  <Text className="text-base font-semibold text-primary">
                    {expense.currency} {expense.amount.toFixed(2)}
                  </Text>
                </View>
                {expense.description !== "" && (
                  <Text className="mt-1 text-sm text-foreground/60">
                    {expense.description}
                  </Text>
                )}
                <View className="mt-2 flex-row items-center gap-2">
                  <View className="rounded-full bg-muted px-2.5 py-0.5">
                    <Text className="text-xs text-foreground/60">
                      {expense.status}
                    </Text>
                  </View>
                  {expense.receiptUri !== "" && (
                    <Text className="text-xs text-foreground/40">
                      Receipt attached
                    </Text>
                  )}
                  {!expense.synced && (
                    <Text className="text-xs text-primary">Pending sync</Text>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
