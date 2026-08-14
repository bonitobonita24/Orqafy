"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

type LoginState = { error: string } | null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </Field>
  );
}

interface LoginFormProps {
  action: (prevState: LoginState, formData: FormData) => Promise<LoginState>;
}

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useActionState(action, null);
  const [isVisible, setIsVisible] = useState(false);

  return (
    <form data-fdl="login-form" action={formAction} className="space-y-4">
      {state?.error != null && state.error !== "" && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <FieldGroup className="gap-4">
        {/* Workspace */}
        <Field className="gap-1">
          <FieldLabel htmlFor="tenantSlug" className="leading-5">
            Workspace
          </FieldLabel>
          <Input
            id="tenantSlug"
            name="tenantSlug"
            type="text"
            placeholder="demo"
            required
            autoComplete="organization"
          />
        </Field>

        {/* Email */}
        <Field className="gap-1">
          <FieldLabel htmlFor="email" className="leading-5">
            Email address*
          </FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </Field>

        {/* Password */}
        <Field className="gap-1">
          <FieldLabel htmlFor="password" className="leading-5">
            Password*
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="password"
              name="password"
              type={isVisible ? "text" : "password"}
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

        <SubmitButton />
      </FieldGroup>

      <p className="text-center text-xs text-muted-foreground">
        Don&apos;t have a workspace yet?{" "}
        <Link href="/register" className="text-card-foreground hover:underline">
          Create one free
        </Link>
      </p>
    </form>
  );
}
