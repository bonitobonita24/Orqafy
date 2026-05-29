"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type LoginState = { error: string } | null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-[#00d992] text-background font-semibold hover:bg-[#2fd6a1] hover:shadow-[0_0_16px_#00d99240] transition-all"
    >
      {pending ? "Signing in…" : "Sign in →"}
    </Button>
  );
}

interface LoginFormProps {
  action: (prevState: LoginState, formData: FormData) => Promise<LoginState>;
}

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="tenantSlug">Workspace</Label>
        <Input
          id="tenantSlug"
          name="tenantSlug"
          type="text"
          placeholder="demo"
          required
          autoComplete="organization"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      <SubmitButton />

      <p className="text-center text-xs text-muted-foreground">
        Don&apos;t have a workspace yet?{" "}
        <Link href="/register" className="text-[#00d992] hover:underline">
          Create one free
        </Link>
      </p>
    </form>
  );
}
