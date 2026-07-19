import { useRef, useState } from "react";
import { View, Text, ScrollView, Alert, Modal, Image, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from "expo-camera";
import { database } from "@/storage";
import type { Expense } from "@/storage/models";
import { Button, Input } from "@/components/ui";
import { enqueueSync } from "@/sync";
import { getStoredTenantId } from "@/lib/auth";
import { compressReceiptImage } from "@/lib/receipt-image";

export default function NewExpenseScreen(): React.JSX.Element {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptUri, setReceiptUri] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

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
          record.receiptUri = receiptUri;
          record.status = "draft";
          record.synced = false;
        });
        // NOTE: `receiptUri` here is a LOCAL device file URI, not uploaded bytes.
        // The generic /api/sync/expenses leg (and a receipt-upload step mirroring
        // web's trpc.storage.uploadDirect) is not wired yet — see the mobile
        // camera/compression task report for the flagged gap.
        await enqueueSync("expenses", entry.id, "create", {
          amount: parsedAmount,
          currency: "PHP",
          category: category.trim(),
          description: description.trim(),
          receiptUri,
          status: "draft",
        });
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
    </SafeAreaView>
  );
}
