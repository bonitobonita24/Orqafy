import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTRPCContext } from "@/server/trpc/context";

// Non-tRPC: this Route Handler is the only allowed use-case for Route Handlers with tRPC.
// Auth + tenant scoping happen inside createTRPCContext and tRPC middleware — not here.
const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    ...(process.env.NODE_ENV === "development"
      ? {
          onError: ({ path, error }: { path: string | undefined; error: Error }) => {
            console.error(`tRPC error on ${path ?? "<unknown>"}:`, error);
          },
        }
      : {}),
  });

export { handler as GET, handler as POST };
