import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { database } from "@/storage";
import type { Expense } from "@/storage/models";
import { Button, Input } from "@/components/ui";
import { enqueueSync } from "@/sync";
import { getStoredTenantId } from "@/lib/auth";

export default function NewExpenseScreen(): React.JSX.Element {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Validation", "Please enter a valid amount.");
      return;
    }
    if (category.trim() === "") {
      Alert.alert("Validation", "Please enter a category.");
      return;
    }

    setIsSubmitting(true);
    try {
      const tenantId = await getStoredTenantId();
      if (tenantId === null) {
        Alert.alert("Error", "No tenant found. Please log in again.");
        return;
      }

      await database.write(async () => {
        const collection = database.get<Expense>("expenses");
        const entry = await collection.create((record) => {
          record.tenantId = tenantId;
          record.amount = parsedAmount;
          record.currency = "PHP";
          record.category = category.trim();
          record.description = description.trim();
          record.receiptUri = "";
          record.status = "draft";
          record.synced = false;
        });
        await enqueueSync("expenses", entry.id, "create", {});
      });
      router.back();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to create expense";
      Alert.alert("Error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView
        className="flex-1 px-4 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-6 text-2xl font-bold text-foreground">
          New Expense
        </Text>

        <View className="gap-4">
          <Input
            label="Amount (PHP)"
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />

          <Input
            label="Category"
            placeholder="e.g. Transportation, Meals, Supplies"
            value={category}
            onChangeText={setCategory}
          />

          <Input
            label="Description"
            placeholder="Brief description of the expense"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <View className="mt-2">
            <Button
              title="Submit Expense"
              onPress={() => void handleSubmit()}
              isLoading={isSubmitting}
            />
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
