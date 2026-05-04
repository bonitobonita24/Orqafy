import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { OfflineBanner } from "@/components/common";

function TabIcon({
  label,
  focused,
}: {
  label: string;
  focused: boolean;
}): React.JSX.Element {
  return (
    <Text
      className={`text-xs font-medium ${focused ? "text-primary" : "text-foreground/40"}`}
    >
      {label}
    </Text>
  );
}

export default function AppLayout(): React.JSX.Element {
  return (
    <View className="flex-1 bg-background">
      <OfflineBanner />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: "#050507" },
          headerTintColor: "#E8E8ED",
          headerTitleStyle: { fontWeight: "600" },
          tabBarStyle: {
            backgroundColor: "#0D0D11",
            borderTopColor: "#2C2C2E",
          },
          tabBarActiveTintColor: "#00d992",
          tabBarInactiveTintColor: "#6B6B70",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ focused }) => (
              <TabIcon label="🏠" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="dtr"
          options={{
            title: "DTR",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon label="⏰" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: "Tasks",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon label="📋" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="expenses"
          options={{
            title: "Expenses",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon label="💰" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="payslips"
          options={{
            title: "Payslips",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon label="📄" focused={focused} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
