import { env } from "@/env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify a Cloudflare Turnstile token against Cloudflare's siteverify endpoint.
 * Returns true if the token is valid for the given remote IP, false otherwise.
 * Network errors and malformed responses resolve to false (fail-closed).
 */
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  try {
    const resp = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
    });
    const data = (await resp.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
