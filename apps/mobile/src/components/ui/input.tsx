import { TextInput, View, Text, type TextInputProps } from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({
  label,
  error,
  ...props
}: InputProps): React.JSX.Element {
  return (
    <View className="gap-1.5">
      {label !== undefined && (
        <Text className="text-sm font-medium text-foreground/80">{label}</Text>
      )}
      <TextInput
        className={`rounded-lg border bg-card px-4 py-3 text-base text-foreground ${
          error !== undefined ? "border-destructive" : "border-border"
        }`}
        placeholderTextColor="#6B6B70"
        {...props}
      />
      {error !== undefined && (
        <Text className="text-xs text-destructive">{error}</Text>
      )}
    </View>
  );
}
