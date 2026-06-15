import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Workspace created — Orqafy" };

export default async function RegisterSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { workspace } = await searchParams;
  const slug = workspace ?? "your-workspace";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary bg-card signal-glow">
          <svg
            className="h-8 w-8 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Workspace created!
          </h1>
          <p className="text-sm text-muted-foreground">
            Your workspace{" "}
            <span className="font-code text-primary">{slug}</span> is being
            set up. This usually takes under a minute.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4 text-left">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                1
              </span>
              <div>
                <p className="text-sm font-medium">Provisioning your workspace</p>
                <p className="text-xs text-muted-foreground">
                  We&apos;re creating your dedicated database schema and seeding
                  initial data.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                2
              </span>
              <div>
                <p className="text-sm font-medium">Check your email</p>
                <p className="text-xs text-muted-foreground">
                  A confirmation email with your login link is on its way.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                3
              </span>
              <div>
                <p className="text-sm font-medium">Sign in to get started</p>
                <p className="text-xs text-muted-foreground">
                  Once provisioning completes, sign in at{" "}
                  <span className="font-code text-xs">
                    orqafy.app/{slug}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-background transition-all hover:bg-primary"
          >
            Sign in now
          </Link>
          <Link
            href="/"
            className="rounded-md border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
