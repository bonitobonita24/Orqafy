"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccountFormProps {
  initialName: string;
  initialTimezone: string;
  initialCurrency: string;
}

export function AccountForm({
  initialName,
  initialTimezone,
  initialCurrency,
}: AccountFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [currency, setCurrency] = useState(initialCurrency);
  const [error, setError] = useState<string | null>(null);

  const update = trpc.tenant.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Tenant settings saved.");
      setError(null);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    const trimmedTimezone = timezone.trim();
    const trimmedCurrency = currency.trim().toUpperCase();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      setError("Name must be between 1 and 100 characters.");
      return;
    }
    if (trimmedCurrency.length !== 3) {
      setError("Currency must be a 3-letter code (e.g. PHP, USD).");
      return;
    }
    update.mutate({
      name: trimmedName,
      timezone: trimmedTimezone,
      currency: trimmedCurrency,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-6 space-y-5"
    >
      <h2 className="text-sm font-medium">Tenant details</h2>
      <p className="text-xs text-muted-foreground -mt-3">
        These settings apply to all users in this workspace.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="tenant-name">Workspace name</Label>
        <Input
          id="tenant-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          className="bg-background"
          placeholder="Acme Corp"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tenant-timezone">Timezone</Label>
        <Input
          id="tenant-timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="bg-background"
          placeholder="Asia/Manila"
        />
        <p className="text-xs text-muted-foreground">
          IANA timezone string, e.g. Asia/Manila, America/New_York.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tenant-currency">Currency</Label>
        <Input
          id="tenant-currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          maxLength={3}
          className="bg-background font-mono uppercase tracking-widest"
          placeholder="PHP"
        />
        <p className="text-xs text-muted-foreground">
          ISO 4217 3-letter code, e.g. PHP, USD, EUR.
        </p>
      </div>

      {error !== null && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={update.isPending}
          className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"
          variant="outline"
        >
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
