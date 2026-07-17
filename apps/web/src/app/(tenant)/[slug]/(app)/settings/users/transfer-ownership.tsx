"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OwnershipCandidate {
  id: string;
  label: string;
}

interface TransferOwnershipProps {
  candidates: OwnershipCandidate[];
}

export function TransferOwnership({ candidates }: TransferOwnershipProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const mutation = trpc.user.transferOwnership.useMutation({
    onSuccess: () => {
      toast.success("Tenant ownership transferred.");
      setOpen(false);
      setError(null);
      setSelectedId(undefined);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  function handleConfirm() {
    if (selectedId === undefined) return;
    setError(null);
    mutation.mutate({ toUserId: selectedId });
  }

  if (candidates.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled title="No eligible members to transfer to.">
        Transfer ownership
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setError(null);
        if (!v) setSelectedId(undefined);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Transfer ownership
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer tenant ownership</DialogTitle>
          <DialogDescription>
            You will hand tenant ownership to the selected member and step down as
            owner. Only the new owner (or a platform manager) can transfer it back.
          </DialogDescription>
        </DialogHeader>
        <Select
          {...(selectedId !== undefined ? { value: selectedId } : {})}
          onValueChange={(value) => setSelectedId(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a member…" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error !== null && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={mutation.isPending || selectedId === undefined}
          >
            {mutation.isPending ? "Transferring…" : "Transfer ownership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
