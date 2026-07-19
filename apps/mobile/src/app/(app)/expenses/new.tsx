import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Alert, Modal, Image, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from "expo-camera";
import { database } from "@/storage";
import type { Expense } from "@/storage/models";
import { Button, Input } from "@/components/ui";
import { prepareSyncQueueItem, prepareReceiptUploadQueueItem } from "@/sync";
import { apiFetch } from "@/api";
import { getStoredTenantId } from "@/lib/auth";
import { compressReceiptImage } from "@/lib/receipt-image";

interface ExpenseCategory {
  id: string;
  name: string;
}

export default function NewExpenseScreen(): React.JSX.Element {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptUri, setReceiptUri] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Owner decision (see server/sync/handlers/expenses.ts): mobile uses a
  // real category picker sourced from GET /api/sync/expense-categories, not
  // free text — the server requires a real expenseCategoryId (cuid).
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsCategoriesLoading(true);
      setCategoriesError(null);
      try {
        const result = await apiFetch<ExpenseCategory[]>("/api/sync/expense-categories");
        if (!cancelled) setCategories(result);
      } catch (error) {
        if (!cancelled) {
          setCategoriesError(
            error instanceof Error ? error.message : "Failed to load categories",
          );
        }
      } finally {
        if (!cancelled) setIsCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCamera = async (): Promise<void> => {
    if (permission?.granted !== true) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Camera permission needed",
          "Enable camera access in your device settings to attach a receipt photo.",
        );
        return;
      }
    }
    setIsCameraOpen(true);
  };

  const handleCapture = async (): Promise<void> => {
    if (cameraRef.current === null || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo: CameraCapturedPicture | undefined = await cameraRef.current.takePictureAsync({
        quality: 1,
      });
      if (photo === undefined) {
        throw new Error("Camera did not return a photo.");
      }
      const compressed = await compressReceiptImage(photo.uri, photo.width, photo.height);
      setReceiptUri(compressed.uri);
      setIsCameraOpen(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to capture receipt photo";
      Alert.alert("Camera error", msg);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Validation", "Please enter a valid amount.");
      return;
    }
    if (selectedCategory === null) {
      Alert.alert("Validation", "Please select a category.");
      return;
    }
    if (description.trim() === "") {
      Alert.alert("Validation", "Please enter a description.");
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
        const entry = collection.prepareCreate((record) => {
          record.tenantId = tenantId;
          record.amount = parsedAmount;
          record.currency = "PHP";
          // `category` here is the display NAME only (local list/detail
          // rendering) — the sync payload below carries the real
          // expenseCategoryId the server needs; it is never re-derived from
          // this column.
          record.category = selectedCategory.name;
          record.description = description.trim();
          record.receiptUri = receiptUri;
          record.status = "draft";
          record.synced = false;
        });

        // Payload must match createExpenseSchema in
        // server/sync/handlers/expenses.ts exactly. `receiptUri` is a LOCAL
        // device file path — it is NEVER sent as part of this payload (the
        // server has nothing to do with it); the receipt's bytes are
        // uploaded separately, as a SECOND queue item, once this create has
        // synced and produced a real server expense id (see
        // prepareReceiptUploadQueueItem + syncReceiptUploadItem in
        // sync/queue.ts).
        const createItem = prepareSyncQueueItem("expenses", entry.id, "create", {
          expenseCategoryId: selectedCategory.id,
          description: description.trim(),
          amount: parsedAmount,
          currency: "PHP",
          date: new Date().toISOString(),
        });

        if (receiptUri !== "") {
          await database.batch(
            entry,
            createItem,
            prepareReceiptUploadQueueItem(entry.id, receiptUri),
          );
        } else {
          await database.batch(entry, createItem);
        }
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

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground/80">Category</Text>
            <Pressable
              onPress={() => setIsCategoryPickerOpen(true)}
              disabled={isCategoriesLoading || categories.length === 0}
              className="flex-row items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <Text
                className={`text-base ${
                  selectedCategory !== null ? "text-foreground" : "text-foreground/40"
                }`}
              >
                {isCategoriesLoading
                  ? "Loading categories..."
                  : (selectedCategory?.name ?? "Select a category")}
              </Text>
            </Pressable>
            {categoriesError !== null && (
              <Text className="text-xs text-destructive">
                Couldn&apos;t load categories: {categoriesError}
              </Text>
            )}
            {!isCategoriesLoading && categories.length === 0 && categoriesError === null && (
              <Text className="text-xs text-foreground/60">
                No expense categories are set up for your organization yet.
              </Text>
            )}
          </View>

          <Input
            label="Description"
            placeholder="Brief description of the expense"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Receipt</Text>
            {receiptUri !== "" ? (
              <View className="gap-2">
                <Image
                  source={{ uri: receiptUri }}
                  className="h-48 w-full rounded-lg"
                  resizeMode="cover"
                />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button
                      title="Retake"
                      variant="secondary"
                      onPress={() => void openCamera()}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      title="Remove"
                      variant="secondary"
                      onPress={() => setReceiptUri("")}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <Button
                title="Capture Receipt"
                variant="secondary"
                onPress={() => void openCamera()}
              />
            )}
          </View>

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

      <Modal visible={isCameraOpen} animationType="slide" onRequestClose={() => setIsCameraOpen(false)}>
        <View className="flex-1 bg-black">
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          <SafeAreaView edges={["bottom"]} className="absolute bottom-0 left-0 right-0">
            <View className="flex-row items-center justify-between px-6 pb-6 pt-4">
              <Pressable onPress={() => setIsCameraOpen(false)} className="px-2 py-2">
                <Text className="text-base font-medium text-white">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleCapture()}
                disabled={isCapturing}
                className="h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/30"
              >
                <View className="h-12 w-12 rounded-full bg-white" />
              </Pressable>
              <View className="w-12" />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        visible={isCategoryPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCategoryPickerOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setIsCategoryPickerOpen(false)}
        >
          <Pressable className="max-h-[70%] rounded-t-2xl bg-background">
            <SafeAreaView edges={["bottom"]}>
              <View className="border-b border-border px-4 py-3">
                <Text className="text-lg font-bold text-foreground">
                  Select a category
                </Text>
              </View>
              <FlatList
                data={categories}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      setSelectedCategory(item);
                      setIsCategoryPickerOpen(false);
                    }}
                    className="border-b border-border/50 px-4 py-3.5"
                  >
                    <Text
                      className={`text-base ${
                        selectedCategory?.id === item.id
                          ? "font-semibold text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                )}
              />
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
