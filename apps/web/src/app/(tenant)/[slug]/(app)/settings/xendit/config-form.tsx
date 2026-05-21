"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const PAYMENT_METHODS = [
  "CARD",
  "EWALLET",
  "BANK_TRANSFER",
  "RETAIL_OUTLET",
  "QR_CODE",
  "DIRECT_DEBIT",
] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function XenditConfigForm() {
  const router = useRouter();
  const { data: config, isLoading } = trpc.adminXenditConfig.get.useQuery();

  const [secretKey, setSecretKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [enabledMethods, setEnabledMethods] = useState<PaymentMethod[]>([]);
  const [hydratedFromConfig, setHydratedFromConfig] = useState(false);

  // Hydrate non-sensitive fields once after first load.
  useEffect(() => {
    if (config !== undefined && config !== null && !hydratedFromConfig) {
      setPublicKey(config.publicKey);
      setIsLive(config.isLive);
      setEnabledMethods(config.enabledMethods as PaymentMethod[]);
      setHydratedFromConfig(true);
    }
  }, [config, hydratedFromConfig]);

  const upsert = trpc.adminXenditConfig.upsert.useMutation({
    onSuccess: () => {
      toast.success("Xendit credentials saved (isVerified reset to false)");
      setSecretKey("");
      setWebhookToken("");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const testConnection = trpc.adminXenditConfig.testConnection.useMutation({
    onSuccess: () => {
      toast.success("Xendit connection verified");
      router.refresh();
    },
    onError: (err) => toast.error(`Verification failed: ${err.message}`),
  });

  const deleteConfig = trpc.adminXenditConfig.delete.useMutation({
    onSuccess: () => {
      toast.success("Xendit configuration removed");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (
      secretKey.trim().length === 0 ||
      publicKey.trim().length === 0 ||
      webhookToken.trim().length === 0
    ) {
      toast.error(
        "Please re-enter all credentials. For your security, existing secrets are never returned to the browser.",
      );
      return;
    }
    upsert.mutate({
      secretKey: secretKey.trim(),
      publicKey: publicKey.trim(),
      webhookToken: webhookToken.trim(),
      isLive,
      enabledMethods,
    });
  }

  function toggleMethod(method: PaymentMethod): void {
    setEnabledMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  }

  function handleDelete(): void {
    if (
      !window.confirm(
        "Remove Xendit configuration? This blocks if any orders still reference Xendit payments.",
      )
    ) {
      return;
    }
    deleteConfig.mutate();
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  const hasConfig = config !== null && config !== undefined;
  const verifiedBadge = hasConfig && config.isVerified;

  return (
    <div className="space-y-6">
      {/* Status panel */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Current status</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasConfig
                ? `Mode: ${config.isLive ? "LIVE" : "TEST"} · Enabled methods: ${
                    config.enabledMethods.length > 0
                      ? config.enabledMethods.join(", ")
                      : "none"
                  }`
                : "No Xendit configuration yet. Enter credentials below."}
            </p>
          </div>
          {hasConfig &&
            (verifiedBadge ? (
              <span className="rounded-md border border-[#00d992] bg-[#00d992]/10 px-2 py-1 text-xs font-medium text-[#00d992]">
                ✓ Verified
              </span>
            ) : (
              <span className="rounded-md border border-amber-500 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600">
                ⚠ Unverified
              </span>
            ))}
        </div>
        {hasConfig && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Secret key: </span>
              <span className="font-mono">
                {config.hasSecretKey ? "••••••••••••••" : "(empty)"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Webhook token: </span>
              <span className="font-mono">
                {config.hasWebhookToken ? "••••••••••••••" : "(empty)"}
              </span>
            </div>
          </div>
        )}
        {hasConfig && !verifiedBadge && (
          <button
            type="button"
            onClick={() => testConnection.mutate()}
            disabled={testConnection.isPending}
            className="mt-4 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testConnection.isPending ? "Testing…" : "Test connection"}
          </button>
        )}
      </div>

      {/* Credential form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-border bg-card p-4"
      >
        <h2 className="text-sm font-medium">
          {hasConfig ? "Rotate credentials" : "Add credentials"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasConfig
            ? "Re-enter all three credentials to save. Existing values cannot be returned to this form for security reasons."
            : "Find these values in your Xendit dashboard under Settings → Developers → API Keys."}
        </p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Secret key
            </span>
            <input
              type="password"
              autoComplete="off"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="xnd_production_… or xnd_development_…"
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Public key
            </span>
            <input
              type="text"
              autoComplete="off"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="xnd_public_…"
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Webhook verification token
            </span>
            <input
              type="password"
              autoComplete="off"
              value={webhookToken}
              onChange={(e) => setWebhookToken(e.target.value)}
              placeholder="from Xendit dashboard → Callbacks"
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isLive}
              onChange={(e) => setIsLive(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-xs">
              Live mode (uncheck for test/sandbox keys)
            </span>
          </label>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              Enabled payment methods
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAYMENT_METHODS.map((method) => (
                <label key={method} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={enabledMethods.includes(method)}
                    onChange={() => toggleMethod(method)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-xs">{method.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="submit"
            disabled={upsert.isPending}
            className="rounded-md border border-[#00d992] bg-[#00d992]/10 px-3 py-1.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {upsert.isPending ? "Saving…" : "Save credentials"}
          </button>
          {hasConfig && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteConfig.isPending}
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteConfig.isPending ? "Removing…" : "Remove configuration"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
