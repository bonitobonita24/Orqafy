"use client";

import { useState, useCallback, useTransition } from "react";
import { registerTenant } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  slug: string;
  name: string;
  priceMonthly: number; // serialized from Prisma Decimal in the server component
}

interface Props {
  plans: Plan[];
  defaultPlan?: string | undefined;
}

type SlugState = "idle" | "checking" | "available" | "taken" | "invalid";

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function RegisterForm({ plans, defaultPlan }: Props) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const [slug, setSlug] = useState("");
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [slugMessage, setSlugMessage] = useState<string>("");

  const [orgName, setOrgName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan ?? plans[0]?.slug ?? "");

  const checkSlug = useCallback((value: string) => {
    clearTimeout(debounceTimer);
    if (value.length === 0) {
      setSlugState("idle");
      setSlugMessage("");
      return;
    }
    setSlugState("checking");
    debounceTimer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/trpc/registration.validateSlug?input=${encodeURIComponent(
              JSON.stringify({ json: { slug: value } })
            )}`
          );
          if (!res.ok) throw new Error("network");
          const data = (await res.json()) as {
            result: { data: { json: { valid: boolean; available: boolean; error?: string } } };
          };
          const { valid, available, error } = data.result.data.json;
          if (!valid) {
            setSlugState("invalid");
            setSlugMessage(error ?? "Invalid workspace ID.");
          } else if (!available) {
            setSlugState("taken");
            setSlugMessage("That workspace ID is already taken.");
          } else {
            setSlugState("available");
            setSlugMessage("Available!");
          }
        } catch {
          setSlugState("idle");
          setSlugMessage("");
        }
      })();
    }, 400);
  }, []);

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(value);
    checkSlug(value);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    if (slugState === "taken" || slugState === "invalid") {
      setFormError(slugMessage);
      return;
    }

    startTransition(async () => {
      const result = await registerTenant({
        slug,
        name: orgName,
        plan: selectedPlan,
        ownerEmail,
        ownerName,
        ownerPassword: password,
      });
      if (result !== undefined && "error" in result) {
        setFormError(result.error);
      }
    });
  }

  const slugBorderColor =
    slugState === "available"
      ? "border-primary"
      : slugState === "taken" || slugState === "invalid"
        ? "border-destructive"
        : "";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldGroup className="gap-4">
        {/* Workspace ID */}
        <Field className="gap-1">
          <FieldLabel htmlFor="slug" className="leading-5">
            Workspace ID*
          </FieldLabel>
          <Input
            id="slug"
            type="text"
            value={slug}
            onChange={handleSlugChange}
            placeholder="acme-corp"
            required
            minLength={3}
            maxLength={63}
            className={cn(slugBorderColor)}
          />
          {slugMessage !== "" && (
            <p
              className={cn(
                "text-xs",
                slugState === "available" ? "text-primary" : "text-destructive"
              )}
            >
              {slugState === "checking" ? "Checking…" : slugMessage}
            </p>
          )}
          {slugState === "checking" && (
            <p className="text-xs text-muted-foreground">Checking…</p>
          )}
          <p className="text-xs text-muted-foreground">
            Your URL: <span className="font-code">orqafy.app/{slug || "your-workspace"}</span>
          </p>
        </Field>

        {/* Organization name */}
        <Field className="gap-1">
          <FieldLabel htmlFor="orgName" className="leading-5">
            Organization name*
          </FieldLabel>
          <Input
            id="orgName"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Corp"
            required
          />
        </Field>

        {/* Admin name */}
        <Field className="gap-1">
          <FieldLabel htmlFor="ownerName" className="leading-5">
            Your name*
          </FieldLabel>
          <Input
            id="ownerName"
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Juan dela Cruz"
            required
          />
        </Field>

        {/* Admin email */}
        <Field className="gap-1">
          <FieldLabel htmlFor="ownerEmail" className="leading-5">
            Work email*
          </FieldLabel>
          <Input
            id="ownerEmail"
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="juan@acmecorp.com"
            required
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
              type={isPasswordVisible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              minLength={8}
            />
            <InputGroupAddon align="inline-end" className="pr-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsPasswordVisible((prevState) => !prevState)}
                className="text-muted-foreground rounded-l-none hover:bg-transparent"
              >
                {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
                <span className="sr-only">
                  {isPasswordVisible ? "Hide password" : "Show password"}
                </span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        {/* Plan selector */}
        {plans.length > 1 && (
          <Field className="gap-1">
            <FieldLabel htmlFor="plan" className="leading-5">
              Plan
            </FieldLabel>
            <select
              id="plan"
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
            >
              {plans.map((p) => {
                const price = Number(p.priceMonthly);
                return (
                  <option key={p.id} value={p.slug}>
                    {p.name} {price === 0 ? "(Free)" : `(₱${price.toLocaleString()}/mo)`}
                  </option>
                );
              })}
            </select>
          </Field>
        )}

        {/* Error */}
        {formError !== null && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}

        <Field>
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || slugState === "checking" || slug === ""}
          >
            {isPending ? "Creating workspace…" : "Create workspace"}
          </Button>
        </Field>
      </FieldGroup>

      <p className="text-center text-xs text-muted-foreground">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  );
}
