"use client";

import { useState, useCallback, useTransition } from "react";
import { registerTenant } from "./actions";

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
      ? "border-[#00d992]"
      : slugState === "taken" || slugState === "invalid"
        ? "border-destructive"
        : "border-input";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Workspace ID */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="slug">
          Workspace ID
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={handleSlugChange}
          placeholder="acme-corp"
          required
          minLength={3}
          maxLength={63}
          className={`w-full rounded-md border ${slugBorderColor} bg-background px-3 py-2 text-sm outline-none ring-offset-background transition-colors focus:ring-1 focus:ring-ring`}
        />
        {slugMessage !== "" && (
          <p
            className={`text-xs ${
              slugState === "available" ? "text-[#00d992]" : "text-destructive"
            }`}
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
      </div>

      {/* Organization name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="orgName">
          Organization name
        </label>
        <input
          id="orgName"
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Acme Corp"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition-colors focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Admin name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ownerName">
          Your name
        </label>
        <input
          id="ownerName"
          type="text"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Juan dela Cruz"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition-colors focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Admin email */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ownerEmail">
          Work email
        </label>
        <input
          id="ownerEmail"
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="juan@acmecorp.com"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition-colors focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 characters"
          required
          minLength={8}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition-colors focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Plan selector */}
      {plans.length > 1 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="plan">
            Plan
          </label>
          <select
            id="plan"
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition-colors focus:ring-1 focus:ring-ring"
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
        </div>
      )}

      {/* Error */}
      {formError !== null && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || slugState === "checking" || slug === ""}
        className="w-full rounded-md bg-[#00d992] px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-[#2fd6a1] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Creating workspace…" : "Create workspace"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  );
}
