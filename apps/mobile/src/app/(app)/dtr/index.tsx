import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { database } from "@/storage";
import type { DtrEntry } from "@/storage/models";
import { Button, Card, CardTitle } from "@/components/ui";
import { useLocation } from "@/hooks";
import { prepareSyncQueueItem } from "@/sync";
import { getStoredTenantId } from "@/lib/auth";
import { formatDateTime } from "@/lib/date";

export default function DtrScreen(): React.JSX.Element {
  const [entries, setEntries] = useState<DtrEntry[]>([]);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fetchLocation, isLoading: isLocationLoading } = useLocation();

  const loadEntries = useCallback(async () => {
    const collection = database.get<DtrEntry>("dtr_entries");
    const recent = await collection
      .query()
      .fetch();
    const sorted = recent.sort(
      (a, b) => (b.clockInAt?.getTime() ?? 0) - (a.clockInAt?.getTime() ?? 0),
    );
    setEntries(sorted.slice(0, 20));
    const openEntry = sorted.find(
      (e) => e.clockInAt !== null && e.clockOutAt === null,
    );
    setIsClockedIn(openEntry !== undefined);
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleClockIn = async (): Promise<void> => {
    setIsSubmitting(true);
    try {
      const position = await fetchLocation();
      if (position === null) {
        Alert.alert("Location Required", "GPS location is needed to clock in.");
        return;
      }
      const tenantId = await getStoredTenantId();
      if (tenantId === null) {
        Alert.alert("Error", "No tenant found. Please log in again.");
        return;
      }

      await database.write(async () => {
        const collection = database.get<DtrEntry>("dtr_entries");
        const entry = collection.prepareCreate((record) => {
          record.tenantId = tenantId;
          record.clockInAt = new Date();
          record.clockInLat = position.latitude;
          record.clockInLng = position.longitude;
          record.clockInAccuracy = position.accuracy;
          record.status = "clocked_in";
          record.synced = false;
        });
        // Payload must match clockInSchema in
        // server/sync/handlers/dtr-entries.ts exactly ({ lat, lng }).
        await database.batch(
          entry,
          prepareSyncQueueItem("dtr_entries", entry.id, "create", {
            lat: position.latitude,
            lng: position.longitude,
          }),
        );
      });
      await loadEntries();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Clock-in failed";
      Alert.alert("Error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockOut = async (): Promise<void> => {
    setIsSubmitting(true);
    try {
      const position = await fetchLocation();
      if (position === null) {
        Alert.alert("Location Required", "GPS location is needed to clock out.");
        return;
      }

      const collection = database.get<DtrEntry>("dtr_entries");
      const openEntries = await collection.query().fetch();
      const openEntry = openEntries.find(
        (e) => e.clockInAt !== null && e.clockOutAt === null,
      );
      if (openEntry === undefined) {
        Alert.alert("Error", "No open clock-in found.");
        return;
      }

      await database.write(async () => {
        // Payload must match clockOutSchema in
        // server/sync/handlers/dtr-entries.ts exactly ({ lat, lng }).
        await database.batch(
          openEntry.prepareUpdate((record) => {
            record.clockOutAt = new Date();
            record.clockOutLat = position.latitude;
            record.clockOutLng = position.longitude;
            record.clockOutAccuracy = position.accuracy;
            record.status = "clocked_out";
            record.synced = false;
          }),
          prepareSyncQueueItem("dtr_entries", openEntry.id, "update", {
            lat: position.latitude,
            lng: position.longitude,
          }),
        );
      });
      await loadEntries();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Clock-out failed";
      Alert.alert("Error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loading = isSubmitting || isLocationLoading;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView className="flex-1 px-4 pt-4">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground">
            Daily Time Record
          </Text>
          <Text className="mt-1 text-sm text-foreground/60">
            {isClockedIn ? "Currently clocked in" : "Not clocked in"}
          </Text>
        </View>

        <View className="mb-6">
          {isClockedIn ? (
            <Button
              title="Clock Out"
              variant="destructive"
              onPress={() => void handleClockOut()}
              isLoading={loading}
            />
          ) : (
            <Button
              title="Clock In"
              onPress={() => void handleClockIn()}
              isLoading={loading}
            />
          )}
        </View>

        <View className="gap-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardTitle>
                {entry.status === "clocked_in" ? "Active" : "Completed"}
              </CardTitle>
              <Text className="mt-1 text-sm text-foreground/60">
                In: {entry.clockInAt !== null ? formatDateTime(entry.clockInAt) : "—"}
              </Text>
              {entry.clockOutAt !== null && (
                <Text className="text-sm text-foreground/60">
                  Out: {formatDateTime(entry.clockOutAt)}
                </Text>
              )}
              {!entry.synced && (
                <Text className="mt-1 text-xs text-primary">Pending sync</Text>
              )}
            </Card>
          ))}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
