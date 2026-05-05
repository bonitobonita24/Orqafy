import { z } from "zod";
import Constants from "expo-constants";

const envSchema = z.object({
  API_URL: z.string().url(),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
});

const extra: Record<string, unknown> = (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ?? {};

export const env = envSchema.parse({
  API_URL: typeof extra.apiUrl === "string" ? extra.apiUrl : "http://localhost:42951",
  APP_ENV: typeof extra.appEnv === "string" ? extra.appEnv : "development",
});
