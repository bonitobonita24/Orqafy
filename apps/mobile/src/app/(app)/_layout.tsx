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
          headerStyle: { backgroundColor: "#0a0a0a" },
          headerTintColor: "#fafafa",
          headerTitleStyle: { fontWeight: "600" },
          tabBarStyle: {
            backgroundColor: "#0a0a0a",
            borderTopColor: "#262626",
          },
          tabBarActiveTintColor: "#fafafa",
          tabBarInactiveTintColor: "#a3a3a3",
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
