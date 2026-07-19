/**
 * D-push — Expo push notification fan-out. Sends a device push alongside the
 * durable in-app `Notification` row (createNotification calls this, D7).
 *
 * Tenant correctness: token lookup is scoped by BOTH userId AND tenantId —
 * a caller can never fan out to another tenant's devices.
 *
 * Fail-soft contract (same posture as valkey.ts): a push failure — network,
 * timeout, or Expo-side error — must NEVER throw into the caller. The durable
 * Prisma row is the source of truth; push is a best-effort convenience.
 *
 * Token cleanup: Expo returns "DeviceNotRegistered" (in the send-ticket or a
 * later receipt) when a token is no longer valid (app uninstalled, token
 * rotated, etc). On that response we delete the matching DevicePushToken row
 * so we stop wasting sends on a dead token.
 *
 * PII/minimalism: the push payload carries only what's needed to route the
 * user in-app (title/body/small `data` object with ids) — never additional
 * PII beyond what the caller explicitly passes.
 */
import { prisma } from "@orqafy/db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;

export interface SendPushInput {
  tenantId: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data?: ExpoPushTicket[];
}

/**
 * Fan out a push notification to every device token the recipient has
 * registered (tenant-scoped). No-ops silently when the user has no tokens.
 * Never throws — all failure modes are swallowed after being handled.
 */
export async function sendPushToUser(input: SendPushInput): Promise<void> {
  try {
    const tokens = await prisma.devicePushToken.findMany({
      where: { userId: input.userId, tenantId: input.tenantId },
      select: { id: true, token: true },
    });

    if (tokens.length === 0) {
      return;
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      title: input.title,
      body: input.body,
      ...(input.data !== undefined ? { data: input.data } : {}),
    }));

    const response = await postWithRetry(messages);
    if (response === null) {
      return;
    }

    const tickets = response.data ?? [];
    const staleTokens: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const token = tokens[i];
      if (
        ticket !== undefined &&
        token !== undefined &&
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered"
      ) {
        staleTokens.push(token.token);
      }
    }

    if (staleTokens.length > 0) {
      await prisma.devicePushToken.deleteMany({
        where: {
          userId: input.userId,
          tenantId: input.tenantId,
          token: { in: staleTokens },
        },
      });
    }
  } catch {
    // Fail-soft: never let a push failure break the caller (see valkey.ts).
  }
}

async function postWithRetry(
  messages: unknown[]
): Promise<ExpoPushResponse | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        // Non-2xx from Expo — do not retry a rejected request body, just stop.
        return null;
      }
      return (await res.json()) as ExpoPushResponse;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      // retry on network/timeout failure only
    }
  }
  void lastError;
  return null;
}
