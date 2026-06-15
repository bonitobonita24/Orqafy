import type { Metadata } from "next";
import { signIn } from "@/server/auth";
import { AuthError } from "next-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Try the demo — Orqafy" };

async function enterDemo() {
  "use server";
  const password = process.env["WEBMASTER_PASSWORD"];
  if (password === undefined || password === "") {
    throw new Error("DEMO_UNAVAILABLE");
  }
  try {
    await signIn("credentials", {
      email: "webmaster@orqafy.local",
      password,
      tenantSlug: "demo",
      redirectTo: "/demo/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      throw new Error("DEMO_AUTH_FAILED");
    }
    throw err;
  }
}

export default function DemoLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-primary bg-card signal-glow">
            <span className="text-2xl font-bold text-primary">O</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Explore Orqafy</h1>
          <p className="text-sm text-muted-foreground">
            Jump into a live demo workspace — no account needed.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary signal-glow" />
              Pre-loaded with sample data
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary signal-glow" />
              Full access to all modules
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary signal-glow" />
              Resets automatically each day
            </div>
          </div>

          <form action={enterDemo}>
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-primary hover:shadow-none"
            >
              Enter demo workspace →
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Ready to use your own workspace?{" "}
          <a href="/register" className="text-primary hover:underline">
            Create one free
          </a>
        </p>
      </div>
    </div>
  );
}
