import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Q } from "@nozbe/watermelondb";
import { database } from "@/storage";
import type { Payslip } from "@/storage/models";
import { Card, CardTitle } from "@/components/ui";
import { EmptyState } from "@/components/common";
import { formatDate } from "@/lib/date";
import { getStoredUserId } from "@/lib/auth";
import { pullAll } from "@/sync";

export default function PayslipsScreen(): React.JSX.Element {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadPayslips = useCallback(async () => {
    // Defence in depth: the local table is full-replaced by whichever user
    // is currently logged in (reset-on-login.ts wipes it on a user switch),
    // but this filter means even a residual/unwiped row from a prior user
    // can never render on screen.
    const userId = await getStoredUserId();
    if (userId === null) {
      setPayslips([]);
      return;
    }
    const collection = database.get<Payslip>("payslips");
    const all = await collection.query(Q.where("user_id", userId)).fetch();
    const sorted = all.sort(
      (a, b) =>
        (b.periodEnd?.getTime() ?? 0) - (a.periodEnd?.getTime() ?? 0),
    );
    setPayslips(sorted);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await pullAll();
      await loadPayslips();
    } finally {
      setRefreshing(false);
    }
  }, [loadPayslips]);

  useEffect(() => {
    void loadPayslips();
  }, [loadPayslips]);

  if (payslips.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
        >
          <EmptyState
            title="No payslips"
            description="Your payslip history will appear here once synced."
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
        <Text className="mb-4 text-2xl font-bold text-foreground">
          Payslips
        </Text>

        <View className="gap-3">
          {payslips.map((payslip) => (
            <Card key={payslip.id}>
              <CardTitle>
                {payslip.periodStart !== null && payslip.periodEnd !== null
                  ? `${formatDate(payslip.periodStart)} — ${formatDate(payslip.periodEnd)}`
                  : "Pay Period"}
              </CardTitle>
              <View className="mt-3 gap-1">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-foreground/60">Gross Pay</Text>
                  <Text className="text-sm font-medium text-foreground">
                    PHP {payslip.grossPay.toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-foreground/60">Deductions</Text>
                  <Text className="text-sm font-medium text-destructive">
                    - PHP {parseFloat(payslip.deductions).toFixed(2)}
                  </Text>
                </View>
                <View className="mt-1 flex-row justify-between border-t border-border pt-2">
                  <Text className="text-sm font-semibold text-foreground">
                    Net Pay
                  </Text>
                  <Text className="text-sm font-bold text-primary">
                    PHP {payslip.netPay.toFixed(2)}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
