import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/hooks";

export default function LoginScreen(): React.JSX.Element {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (): Promise<void> => {
    if (email.trim() === "" || password === "") {
      Alert.alert("Validation", "Please enter your email and password.");
      return;
    }
    try {
      await login(email.trim(), password);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Login failed. Please try again.";
      Alert.alert("Login Failed", message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerClassName="flex-1 justify-center px-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-10">
            <Text className="text-3xl font-bold text-primary">Orqafy</Text>
            <Text className="mt-2 text-base text-foreground/60">
              Sign in to your account
            </Text>
          </View>

          <View className="gap-4">
            <Input
              label="Email"
              placeholder="you@company.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
            />

            <View className="mt-2">
              <Button
                title="Sign In"
                onPress={() => void handleLogin()}
                isLoading={isLoading}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
