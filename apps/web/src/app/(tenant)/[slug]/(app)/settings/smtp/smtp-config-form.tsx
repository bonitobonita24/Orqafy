"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function SmtpConfigForm() {
  const router = useRouter();
  const { data: config, isLoading } = trpc.smtpConfig.get.useQuery();

  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [fromName, setFromName] = useState("");
  const [useTls, setUseTls] = useState(true);
  const [hydratedFromConfig, setHydratedFromConfig] = useState(false);

  // Hydrate non-sensitive fields once after first load.
  useEffect(() => {
    if (config !== undefined && config !== null && !hydratedFromConfig) {
      setHost(config.host);
      setPort(config.port);
      setUsername(config.username);
      setFromAddress(config.fromAddress);
      setFromName(config.fromName);
      setUseTls(config.useTls);
      setHydratedFromConfig(true);
    }
  }, [config, hydratedFromConfig]);

  const upsert = trpc.smtpConfig.upsert.useMutation({
    onSuccess: () => {
      toast.success("SMTP configuration saved (isVerified reset — run test to re-verify).");
      setPassword("");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const testConnection = trpc.smtpConfig.testConnection.useMutation({
    onSuccess: () => {
      toast.success("SMTP connection verified successfully.");
      router.refresh();
    },
    onError: (err) => toast.error(`Verification failed: ${err.message}`),
  });

  const deleteConfig = trpc.smtpConfig.delete.useMutation({
    onSuccess: () => {
      toast.success("SMTP configuration removed.");
      setHost("");
      setPort(587);
      setUsername("");
      setPassword("");
      setFromAddress("");
      setFromName("");
      setUseTls(true);
      setHydratedFromConfig(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (
      host.trim().length === 0 ||
      username.trim().length === 0 ||
      password.trim().length === 0 ||
      fromAddress.trim().length === 0 ||
      fromName.trim().length === 0
    ) {
      toast.error(
        "Please fill in all required fields. For your security, the existing password is never returned to the browser.",
      );
      return;
    }
    upsert.mutate({
      host: host.trim(),
      port,
      username: username.trim(),
      password: password.trim(),
      fromAddress: fromAddress.trim(),
      fromName: fromName.trim(),
      useTls,
    });
  }

  function handleDelete(): void {
    if (
      !window.confirm(
        "Remove SMTP configuration? Transactional emails will stop working until a new configuration is saved.",
      )
    )
      return;
    deleteConfig.mutate();
  }

  const hasConfig = config !== null && config !== undefined;

  const fieldClass =
    "mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm";

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading SMTP configuration…</p>;
  }

  return (
    <div className="space-y-6">
      {/* Status badge */}
      {hasConfig && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <span
            className={
              config.isVerified
                ? "text-xs font-medium text-green-600 dark:text-green-400"
                : "text-xs font-medium text-amber-600 dark:text-amber-400"
            }
          >
            {config.isVerified ? "● Verified" : "○ Not verified"}
          </span>
          <span className="text-xs text-muted-foreground">
            {config.isVerified
              ? "Connection test passed."
              : "Save credentials then run Test Connection to verify."}
          </span>
          {hasConfig && (
            <button
              type="button"
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending}
              className="ml-auto rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testConnection.isPending ? "Testing…" : "Test connection"}
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Server section */}
        <div className="rounded-lg border border-border bg-card px-6 py-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Server
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Host *</span>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="smtp.example.com"
                  className={fieldClass}
                  required
                />
              </label>
            </div>
            <div>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Port *</span>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  min={1}
                  max={65535}
                  className={fieldClass}
                  required
                />
              </label>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useTls}
              onChange={(e) => setUseTls(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            <span>Use TLS / STARTTLS</span>
          </label>
        </div>

        {/* Auth section */}
        <div className="rounded-lg border border-border bg-card px-6 py-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Authentication
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">Username *</span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user@example.com"
                className={fieldClass}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">
                Password *{hasConfig && " (re-enter to change)"}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  hasConfig ? "Re-enter to update" : "SMTP password or app-specific password"
                }
                className={`${fieldClass} font-mono`}
              />
              {hasConfig && (
                <p className="mt-1 text-xs text-muted-foreground">
                  For your security, the existing password is never returned to the browser.
                </p>
              )}
            </label>
          </div>
        </div>

        {/* From address section */}
        <div className="rounded-lg border border-border bg-card px-6 py-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sender identity
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">From address *</span>
              <input
                type="email"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="noreply@yourcompany.com"
                className={fieldClass}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">From name *</span>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Company"
                className={fieldClass}
                required
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={upsert.isPending}
            className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {upsert.isPending ? "Saving…" : "Save SMTP configuration"}
          </button>

          {hasConfig && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteConfig.isPending}
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteConfig.isPending ? "Removing…" : "Remove configuration"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
