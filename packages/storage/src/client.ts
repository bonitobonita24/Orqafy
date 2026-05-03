import { S3Client } from "@aws-sdk/client-s3";

export interface StorageClientConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Set true for MinIO dev — disables path-style deprecation warning for non-AWS endpoints. */
  forcePathStyle?: boolean;
}

export function createStorageClient(config: StorageClientConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle ?? true,
  });
}

/** Build config from environment variables. Works for both MinIO (dev) and Cloudflare R2 (prod). */
export function storageConfigFromEnv(): StorageClientConfig {
  const endpoint = process.env["STORAGE_ENDPOINT"];
  const region = process.env["STORAGE_REGION"] ?? "auto";
  const accessKeyId = process.env["STORAGE_ACCESS_KEY"];
  const secretAccessKey = process.env["STORAGE_SECRET_KEY"];

  if (!endpoint) throw new Error("STORAGE_ENDPOINT is not set");
  if (!accessKeyId) throw new Error("STORAGE_ACCESS_KEY is not set");
  if (!secretAccessKey) throw new Error("STORAGE_SECRET_KEY is not set");

  return { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle: true };
}
