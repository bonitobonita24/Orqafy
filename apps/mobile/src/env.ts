import { z } from "zod";
import Constants from "expo-constants";

const envSchema = z.object({
  API_URL: z.string().url(),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
});

const extra = Constants.expoConfig?.extra ?? {};

export const env = envSchema.parse({
  API_URL: extra.apiUrl ?? "http://localhost:42951",
  APP_ENV: extra.appEnv ?? "development",
});
