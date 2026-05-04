import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { database } from "@/storage";
import { Payslip } from "@/storage/models";
import { Card, CardTitle } from "@/components/ui";
import { EmptyState } from "@/components/common";
import { formatDate } from "@/lib/date";

export default function PayslipsScreen(): React.JSX.Element {
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  const loadPayslips = useCallback(async () => {
    const collection = database.get<Payslip>("payslips");
    const all = await collection.query().fetch();
    const sorted = all.sort(
      (a, b) =>
        (b.periodEnd?.getTime() ?? 0) - (a.periodEnd?.getTime() ?? 0),
    );
    setPayslips(sorted);
  }, []);

  useEffect(() => {
    void loadPayslips();
  }, [loadPayslips]);

  if (payslips.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
        <EmptyState
          title="No payslips"
          description="Your payslip history will appear here once synced."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView className="flex-1 px-4 pt-4">
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
