import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(48),
  // Master encryption key for *Enc columns (TenantSmtpConfig, TenantXenditConfig, etc.).
  // 32 bytes base64 (44 chars). Generate fresh per env: openssl rand -base64 32
  APP_ENCRYPTION_KEY: z.string().min(44),
  NEXTAUTH_URL: z.string().url(),
  REDIS_URL: z.string(),
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_BUCKET: z.string(),
  STORAGE_ACCESS_KEY: z.string(),
  STORAGE_SECRET_KEY: z.string().min(22),
  STORAGE_REGION: z.string().default("us-east-1"),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string(),
  // Turnstile (server-side secret — never exposed to client)
  TURNSTILE_SECRET_KEY: z.string(),
  // Xendit secrets removed as of Batch 21c — now per-tenant via TenantXenditConfig.
  // MaxStorageGB default for free tenants (can override per-tenant in DB)
  DEFAULT_MAX_STORAGE_GB: z.coerce.number().default(0),
});

const clientSchema = z.object({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

const _serverEnv = serverSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  REDIS_URL: process.env.REDIS_URL,
  STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
  STORAGE_BUCKET: process.env.STORAGE_BUCKET,
  STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
  STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
  STORAGE_REGION: process.env.STORAGE_REGION,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  DEFAULT_MAX_STORAGE_GB: process.env.DEFAULT_MAX_STORAGE_GB,
});

const _clientEnv = clientSchema.safeParse({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

if (process.env.SKIP_ENV_VALIDATION !== "1") {
  if (!_serverEnv.success) {
    console.error("❌ Invalid server env vars:", _serverEnv.error.flatten().fieldErrors);
    throw new Error("Invalid server environment variables");
  }

  if (!_clientEnv.success) {
    console.error("❌ Invalid client env vars:", _clientEnv.error.flatten().fieldErrors);
    throw new Error("Invalid client environment variables");
  }

  // Defense-in-depth: zod only validates the 44-char string length.
  // Verify the value actually base64-decodes to 32 bytes (Direction H).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { assertEncryptionKeyHealthy } = require("./lib/startup-health-check") as { assertEncryptionKeyHealthy: () => void };
  assertEncryptionKeyHealthy();
}

export const env = (_serverEnv.success && _clientEnv.success
  ? { ..._serverEnv.data, ..._clientEnv.data }
  : { ...serverSchema.partial().parse({}), ...clientSchema.partial().parse({}) }
) as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>;
