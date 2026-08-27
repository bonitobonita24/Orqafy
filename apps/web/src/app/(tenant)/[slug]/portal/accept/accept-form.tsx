"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Check, EyeIcon, EyeOffIcon } from "@/components/ui/icons";

interface PortalAcceptFormProps {
  tenantSlug: string;
  token: string;
}

const MIN_PASSWORD_LENGTH = 8;

export function PortalAcceptForm({ tenantSlug, token }: PortalAcceptFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const inviteQuery = trpc.customerPortal.acceptInvite.useQuery(
    { token },
    { enabled: token !== "", retry: false },
  );

  const setPasswordMutation = trpc.customerPortal.setPassword.useMutation({
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Invalid token, empty token, or invite lookup failed — generic
  // enumeration-resistant state (never distinguishes "expired" vs "unknown").
  if (token === "" || inviteQuery.isError) {
    return (
      <div data-fdl="portal-accept-invalid" className="space-y-4">
        <p className="text-sm text-destructive">
          This invite link is invalid or has expired.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/${tenantSlug}/portal/login`}>Go to sign in</Link>
        </Button>
      </div>
    );
  }

  if (inviteQuery.isPending) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (setPasswordMutation.isSuccess) {
    return (
      <div data-fdl="portal-accept-success" className="space-y-4 text-center">
        <Check className="mx-auto size-10 text-primary" />
        <p className="text-sm text-muted-foreground">
          Your password has been set. You can now sign in.
        </p>
        <Button asChild className="w-full">
          <Link href={`/${tenantSlug}/portal/login`}>Go to sign in</Link>
        </Button>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setFormError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setPasswordMutation.mutate({ token, password });
  }

  return (
    <form data-fdl="portal-accept-form" onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Setting up portal access for{" "}
        <span className="font-medium text-foreground">{inviteQuery.data?.customerName}</span>{" "}
        ({inviteQuery.data?.email})
      </p>

      {formError !== null && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      )}

      <FieldGroup className="gap-4">
        <Field className="gap-1">
          <FieldLabel htmlFor="password" className="leading-5">
            New password*
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="password"
              name="password"
              type={isVisible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
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

        <Field className="gap-1">
          <FieldLabel htmlFor="confirmPassword" className="leading-5">
            Confirm password*
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="confirmPassword"
              name="confirmPassword"
              type={isVisible ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              placeholder="••••••••••••••••"
            />
          </InputGroup>
        </Field>

        <Field>
          <Button type="submit" className="w-full" disabled={setPasswordMutation.isPending}>
            {setPasswordMutation.isPending ? "Setting password…" : "Set password"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
