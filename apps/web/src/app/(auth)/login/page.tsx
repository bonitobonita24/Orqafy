import type { Metadata } from "next";
import { AuthError } from "next-auth";
import { signIn } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In — Orqafy",
  robots: { index: false, follow: true },
};

type LoginState = { error: string } | null;

async function authenticate(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  "use server";
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const tenantSlug = formData.get("tenantSlug") as string;

  try {
    await signIn("credentials", {
      email,
      password,
      tenantSlug,
      redirectTo: `/${tenantSlug}/dashboard`,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email, password, or workspace." };
    }
    throw err;
  }
  return null;
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-primary bg-card signal-glow">
          <span className="text-2xl font-bold text-primary">O</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your Orqafy workspace.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <LoginForm action={authenticate} />
      </div>
    </div>
  );
}
