"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const LEAVE_TYPES = [
  "vacation",
  "sick",
  "emergency",
  "maternity",
  "paternity",
  "unpaid",
] as const;
type LeaveType = (typeof LEAVE_TYPES)[number];

const LEAVE_LABELS: Record<LeaveType, string> = {
  vacation: "Vacation",
  sick: "Sick",
  emergency: "Emergency",
  maternity: "Maternity",
  paternity: "Paternity",
  unpaid: "Unpaid",
};

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LeaveRequestForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [employeeId, setEmployeeId] = useState<string>("");
  const [leaveType, setLeaveType] = useState<LeaveType>("vacation");
  const [startDate, setStartDate] = useState<string>(todayString());
  const [endDate, setEndDate] = useState<string>(todayString());
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const { data: employeeData } = trpc.employee.list.useQuery({ limit: 200 });

  const create = trpc.dtr.leaveRequestCreate.useMutation({
    onSuccess: () => {
      toast.success("Leave request submitted.");
      router.refresh();
      reset();
      setOpen(false);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  function reset() {
    setEmployeeId("");
    setLeaveType("vacation");
    setStartDate(todayString());
    setEndDate(todayString());
    setReason("");
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    if (!employeeId) {
      setError("Please select an employee.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (endDate < startDate) {
      setError("End date cannot be before start date.");
      return;
    }
    create.mutate({
      employeeId,
      type: leaveType,
      startDate,
      endDate,
      ...(reason.trim().length > 0 && { reason: reason.trim() }),
    });
  }

  const employees = employeeData?.items ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-[#00d992] text-gray-950 hover:bg-[#00d992]/90 h-7 px-3 text-xs font-medium"
        >
          Request Leave
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
          <DialogDescription>
            Submit a leave request for an employee.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Employee
            </Label>
            <Select
              value={employeeId}
              onValueChange={(v) => {
                setEmployeeId(v);
                setError(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.user.displayName ??
                      `${emp.user.firstName} ${emp.user.lastName}`}{" "}
                    <span className="text-muted-foreground text-xs">
                      ({emp.employeeNumber})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Leave type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Leave Type
            </Label>
            <Select
              value={leaveType}
              onValueChange={(v) => setLeaveType(v as LeaveType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {LEAVE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Start Date
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                End Date
              </Label>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Reason{" "}
              <span className="text-muted-foreground/60 font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Brief reason for the leave request…"
              rows={3}
              className="resize-none"
            />
          </div>

          {error !== null && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={create.isPending}
            className="bg-[#00d992] text-gray-950 hover:bg-[#00d992]/90"
          >
            {create.isPending ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
