"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

interface PortalLoginFormProps {
  tenantSlug: string;
}

// Generic, enumeration-resistant error copy — mirrors the "portal" Credentials
// provider's opaque authorize() (null on bad creds, rate-limit, disabled
// portal, or unknown email alike; config.ts + verify-portal-credentials.ts).
const GENERIC_ERROR = "Invalid email or password.";

export function PortalLoginForm({ tenantSlug }: PortalLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await signIn("portal", {
        email,
        password,
        tenantSlug,
        redirect: false,
      });

      if (result?.error !== undefined && result.error !== null) {
        toast.error(GENERIC_ERROR);
        return;
      }

      router.push(`/${tenantSlug}/portal`);
      router.refresh();
    } catch {
      toast.error(GENERIC_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      data-fdl="portal-login-form"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="space-y-4"
    >
      <FieldGroup className="gap-4">
        <Field className="gap-1">
          <FieldLabel htmlFor="email" className="leading-5">
            Email address*
          </FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </Field>

        <Field className="gap-1">
          <FieldLabel htmlFor="password" className="leading-5">
            Password*
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="password"
              name="password"
              type={isVisible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••••••••••"
            />
            <InputGroupAddon align="inline-end" className="pr-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsVisible((prevState) => !prevState)}
                className="text-muted-foreground rounded-l-none hover:bg-transparent"
              >
                {isVisible ? <EyeOffIcon /> : <EyeIcon />}
                <span className="sr-only">
                  {isVisible ? "Hide password" : "Show password"}
                </span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
