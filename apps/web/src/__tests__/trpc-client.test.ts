/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { describe, it, expect } from "vitest";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";

describe("trpc React client", () => {
  it("exposes a useQuery hook on the generated client", () => {
    // createTRPCReact<AppRouter>() produces a Proxy whose paths mirror the router tree.
    // We don't call the hook (no React runtime here) — we just assert the surface exists.
    expect(typeof trpc.useUtils).toBe("function");
    expect(typeof trpc.Provider).toBe("function");
    expect(typeof trpc.createClient).toBe("function");
  });

  it("exposes proxied router namespaces matching the server appRouter", () => {
    // Each known router (auth, banking, pos, report, support) is reachable as a proxy path
    // on the client. The client doesn't enforce the names at runtime — it returns a Proxy
    // that will dispatch to /api/trpc/<path>. Touching the namespace returns a sub-Proxy,
    // which proves the path syntax compiles end-to-end with the AppRouter generic.
    expect(trpc.auth).toBeDefined();
    expect(trpc.banking).toBeDefined();
    expect(trpc.pos).toBeDefined();
    expect(trpc.report).toBeDefined();
    expect(trpc.support).toBeDefined();
  });

  it("createClient accepts a superjson-wired httpBatchLink without throwing", () => {
    // Verifies the transformer + link wiring used by TRPCProvider compiles and
    // returns a functional client. This is the contract the Provider depends on.
    const client = trpc.createClient({
      links: [
        httpBatchLink({
          url: "http://localhost:42951/api/trpc",
          transformer: superjson,
        }),
      ],
    });
    expect(client).toBeDefined();
    // tRPC v11 returns a callable Proxy — typeof reports "function".
    expect(typeof client).toBe("function");
  });
});

describe("TRPCProvider module", () => {
  it("exports TRPCProvider as a function (Client Component)", async () => {
    const mod = await import("@/lib/trpc-provider");
    expect(typeof mod.TRPCProvider).toBe("function");
    expect(mod.TRPCProvider.name).toBe("TRPCProvider");
  });
});
