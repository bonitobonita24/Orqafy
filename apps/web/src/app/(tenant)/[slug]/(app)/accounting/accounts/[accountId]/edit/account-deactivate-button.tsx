"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

interface AccountDeactivateButtonProps {
  accountId: string;
  slug: string;
  isActive: boolean;
}

export function AccountDeactivateButton({ accountId, slug, isActive }: AccountDeactivateButtonProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  const toggleMut = trpc.accounting.account.toggleActive.useMutation({
    onSuccess: () => {
      toast.success(isActive ? "Account deactivated." : "Account activated.");
      router.push(`/${slug}/accounting/accounts`);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (!confirm) {
    return (
      <Button
        type="button"
        variant="outline"
        className={isActive ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-primary/30 text-primary hover:bg-primary/10"}
        onClick={() => setConfirm(true)}
      >
        {isActive ? "Deactivate Account" : "Activate Account"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3">
      <span className="text-sm text-red-400">
        {isActive ? "Confirm deactivation?" : "Confirm activation?"}
      </span>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={toggleMut.isPending}
        onClick={() => toggleMut.mutate({ id: accountId })}
      >
        {toggleMut.isPending ? "Saving…" : "Yes, confirm"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setConfirm(false)}
      >
        Cancel
      </Button>
    </div>
  );
}
