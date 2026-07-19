import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import superjson from "superjson";
import { env } from "@/env";
import { getAuthHeaders } from "@/api/client";

/**
 * Vanilla (non-React) tRPC client — sends the same bearer token apps/mobile's
 * REST-style apiFetch() sends, to the same /api/trpc endpoint apps/web's
 * browser client hits (server/trpc/context.ts already accepts a mobile
 * Bearer JWT ahead of the cookie-session path, see Wave 2 — trpc-bearer).
 * httpBatchLink's `headers` option is re-evaluated per batch, so a token
 * rotated by apiFetch's 401→refresh flow is picked up on the very next call
 * without any extra wiring here.
 *
 * ⚠ NOT typed against the real AppRouter (typed `AnyRouter` — proxy property
 * access is untyped `any`). Importing `AppRouter` from apps/web across the
 * app boundary (`import type { AppRouter } from "@orqafy/web/..."`) forces
 * `tsc` to fully resolve+typecheck web's ENTIRE router source graph — every
 * router file's own imports (zod, @trpc/server, @orqafy/db, etc.) — which
 * apps/mobile does not have; this failed with 100+ TS7031/TS2307 errors in
 * mobile's isolated typecheck. Getting full end-to-end typing back needs
 * either a shared `@orqafy/trpc-types` package that exports ONLY the
 * `AppRouter` type (built/declaration-bundled, no source-graph leakage) or
 * TS project references with `composite: true`. Flagging as an open item —
 * not attempted here to avoid widening this task's blast radius.
 *
 * Existing modules (DTR, tasks, expenses, payslips) continue to use the
 * REST-style `apiFetch` from "@/api" — this client is additive, not a forced
 * migration. New data calls, or an incremental per-module migration, can
 * import `trpcClient` and call e.g. `trpcClient.someRouter.someProcedure.query(...)`
 * once real router typing lands.
 */
export const trpcClient = createTRPCClient<AnyRouter>({
  links: [
    httpBatchLink({
      url: `${env.API_URL}/api/trpc`,
      transformer: superjson,
      headers: async () => getAuthHeaders(),
    }),
  ],
});
