import type { Metadata } from "next";
import { AuthError } from "next-auth";
import { signIn } from "@/server/auth";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Logo from "@/components/shadcn-studio/logo";
import AuthBackgroundShape from "@/assets/svg/auth-background-shape";

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
    <div className="relative flex h-auto min-h-screen w-full items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute">
        <AuthBackgroundShape />
      </div>

      <Card className="z-1 w-full border-none shadow-md sm:max-w-lg">
        <CardHeader className="gap-6">
          <Logo className="gap-3" />

          <div>
            <CardTitle className="mb-1.5 text-2xl">Welcome back</CardTitle>
            <CardDescription className="text-base">
              Sign in to your Orqafy workspace.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <LoginForm action={authenticate} />
        </CardContent>
      </Card>
    </div>
  );
}
