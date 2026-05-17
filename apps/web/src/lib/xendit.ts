import { Xendit } from "xendit-node";

let client: Xendit | null = null;

export function getXenditClient(): Xendit {
  if (client) return client;
  const secretKey = process.env.XENDIT_SECRET_KEY;
  if (secretKey === undefined || secretKey === "") {
    throw new Error("XENDIT_SECRET_KEY is not configured");
  }
  client = new Xendit({ secretKey });
  return client;
}

export function getXenditWebhookToken(): string {
  const token = process.env.XENDIT_WEBHOOK_TOKEN;
  if (token === undefined || token === "") {
    throw new Error("XENDIT_WEBHOOK_TOKEN is not configured");
  }
  return token;
}
