"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EmployeeTerminateProps {
  employeeId: string;
}

function todayString(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

export function EmployeeTerminate({ employeeId }: EmployeeTerminateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dateTerminated, setDateTerminated] = useState(todayString);
  const [error, setError] = useState<string | null>(null);

  const mutation = trpc.employee.terminate.useMutation({
    onSuccess: () => {
      toast.success("Employee terminated.");
      setOpen(false);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  function handleConfirm() {
    setError(null);
    if (dateTerminated.trim() === "") {
      setError("Termination date is required.");
      return;
    }
    mutation.mutate({
      id: employeeId,
      dateTerminated: new Date(`${dateTerminated}T00:00:00`),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(null); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
        >
          Terminate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terminate Employee</DialogTitle>
          <DialogDescription>
            Set the termination date for this employee. This action can be
            reviewed in the audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label
              htmlFor="dateTerminated"
              className="text-xs font-medium text-muted-foreground"
            >
              Termination Date
            </Label>
            <Input
              id="dateTerminated"
              type="date"
              value={dateTerminated}
              onChange={(e) => setDateTerminated(e.target.value)}
            />
          </div>
          {error !== null && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={mutation.isPending}
            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
            variant="outline"
          >
            {mutation.isPending ? "Terminating…" : "Confirm Termination"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
