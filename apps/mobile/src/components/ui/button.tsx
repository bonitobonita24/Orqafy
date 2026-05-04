import { Pressable, Text, ActivityIndicator, type PressableProps } from "react-native";

interface ButtonProps extends PressableProps {
  title: string;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  isLoading?: boolean;
}

const variantStyles = {
  primary: {
    container: "bg-primary active:bg-primary/80",
    text: "text-background font-semibold",
  },
  secondary: {
    container: "bg-muted active:bg-muted/80 border border-border",
    text: "text-foreground font-medium",
  },
  destructive: {
    container: "bg-destructive active:bg-destructive/80",
    text: "text-white font-semibold",
  },
  ghost: {
    container: "active:bg-muted/50",
    text: "text-foreground font-medium",
  },
} as const;

export function Button({
  title,
  variant = "primary",
  isLoading = false,
  disabled,
  ...props
}: ButtonProps): React.JSX.Element {
  const styles = variantStyles[variant];
  const isDisabled = disabled === true || isLoading;

  return (
    <Pressable
      className={`flex-row items-center justify-center rounded-lg px-6 py-3.5 ${styles.container} ${isDisabled ? "opacity-50" : ""}`}
      disabled={isDisabled}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#050507" : "#00d992"}
        />
      ) : (
        <Text className={`text-base ${styles.text}`}>{title}</Text>
      )}
    </Pressable>
  );
}
