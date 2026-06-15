"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

interface AccountFormProps {
  slug: string;
  mode: "create" | "edit";
  accountId?: string;
  initial?: {
    code?: string;
    name?: string;
    type?: AccountType;
    subtype?: string;
    description?: string;
  };
}

export function AccountForm({ slug, mode, accountId, initial = {} }: AccountFormProps) {
  const router = useRouter();

  const [code, setCode] = useState(initial.code ?? "");
  const [name, setName] = useState(initial.name ?? "");
  const [type, setType] = useState<AccountType>(initial.type ?? "asset");
  const [subtype, setSubtype] = useState(initial.subtype ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const createMut = trpc.accounting.account.create.useMutation({
    onSuccess: () => {
      toast.success("Account created.");
      router.push(`/${slug}/accounting/accounts`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const updateMut = trpc.accounting.account.update.useMutation({
    onSuccess: () => {
      toast.success("Account updated.");
      router.push(`/${slug}/accounting/accounts`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const isPending = createMut.isPending || updateMut.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (code.trim() === "") { setError("Account code is required."); return; }
    if (name.trim() === "") { setError("Account name is required."); return; }

    if (mode === "create") {
      createMut.mutate({
        code: code.trim(),
        name: name.trim(),
        type,
        ...(subtype.trim() !== "" ? { subtype: subtype.trim() } : {}),
        ...(description.trim() !== "" ? { description: description.trim() } : {}),
        isSystem: false,
      });
    } else {
      if (accountId === undefined) return;
      updateMut.mutate({
        id: accountId,
        name: name.trim(),
        ...(subtype.trim() !== "" ? { subtype: subtype.trim() } : {}),
        ...(description.trim() !== "" ? { description: description.trim() } : {}),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error !== null && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Code — only editable on create */}
        <div className="space-y-2">
          <Label htmlFor="code">
            Account Code <span className="text-red-400">*</span>
          </Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="1000"
            disabled={mode === "edit"}
            required
          />
          {mode === "edit" && (
            <p className="text-xs text-muted-foreground">Account code cannot be changed after creation.</p>
          )}
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">
            Account Name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cash on Hand"
            required
          />
        </div>

        {/* Type — only selectable on create */}
        <div className="space-y-2">
          <Label htmlFor="type">Account Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as AccountType)}
            disabled={mode === "edit"}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asset">Asset</SelectItem>
              <SelectItem value="liability">Liability</SelectItem>
              <SelectItem value="equity">Equity</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          {mode === "edit" && (
            <p className="text-xs text-muted-foreground">Account type cannot be changed after creation.</p>
          )}
        </div>

        {/* Subtype */}
        <div className="space-y-2">
          <Label htmlFor="subtype">Subtype (optional)</Label>
          <Input
            id="subtype"
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
            placeholder="e.g. current, non-current"
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this account…"
          rows={3}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Account" : "Update Account"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${slug}/accounting/accounts`)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
