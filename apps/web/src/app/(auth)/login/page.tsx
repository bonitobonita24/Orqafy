import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-[#00d992] bg-card signal-glow">
          <span className="text-2xl font-bold text-[#00d992]">O</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Sign in to Orqafy</h1>
        <p className="text-sm text-muted-foreground">Enter your workspace and credentials below</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-center text-sm text-muted-foreground">Login form — Phase 8</p>
      </div>
    </div>
  );
}
