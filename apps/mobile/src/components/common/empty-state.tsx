import { View, Text } from "react-native";

interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({
  title,
  description,
}: EmptyStateProps): React.JSX.Element {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-center text-lg font-semibold text-foreground/60">
        {title}
      </Text>
      {description !== undefined && (
        <Text className="mt-2 text-center text-sm text-foreground/40">
          {description}
        </Text>
      )}
    </View>
  );
}
