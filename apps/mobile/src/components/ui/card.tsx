import { View, Text, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps): React.JSX.Element {
  return (
    <View
      className={`rounded-xl border border-border bg-card p-4 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
}

export function CardTitle({ children }: CardTitleProps): React.JSX.Element {
  return <Text className="text-lg font-semibold text-foreground">{children}</Text>;
}

interface CardDescriptionProps {
  children: React.ReactNode;
}

export function CardDescription({ children }: CardDescriptionProps): React.JSX.Element {
  return <Text className="mt-1 text-sm text-foreground/60">{children}</Text>;
}
