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
import { Button } from "@/components/ui/button";

interface ClockActionsProps {
  /**
   * The AttendanceRecord id (for clock-out).
   * Null means the employee has not clocked in yet today.
   */
  attendanceId: string | null;
  /** The Employee row id (for clock-in). */
  employeeId: string;
  /**
   * Whether there is already a clock-out time on this record.
   * When true the employee has already clocked out today and no action is available.
   */
  hasClockedOut: boolean;
}

/**
 * Employee self-service clock-in / clock-out buttons.
 *
 * Business-rule defaults (flagged):
 *   – One clock-in per calendar day. Attempting a second clock-in returns a
 *     CONFLICT error from the router ("Employee has already clocked in today.")
 *     which is surfaced as a toast.
 *   – Clock-out is only available while a today-record exists and is not yet
 *     closed (hasClockedOut === false).
 *   – GPS coordinates are sent as 0/0 when the browser denies geolocation
 *     (non-blocking fallback — the record is still created; HR can correct
 *     coordinates manually). Flagged: organisations requiring mandatory GPS
 *     should flip this to a hard gate.
 *   – No self-ownership lock on clock-in: the router permits any authenticated
 *     tenant user to clock in for any employee in the same tenant. This matches
 *     the existing pattern for HR/manager proxy clocking. Flagged: if strict
 *     self-only clocking is required, add `employee.userId !== ctx.userId`
 *     guard to `attendanceClockIn` in dtr.ts.
 */
export function ClockActions({
  attendanceId,
  employeeId,
  hasClockedOut,
}: ClockActionsProps) {
  const router = useRouter();
  const [clockInOpen, setClockInOpen] = useState(false);
  const [clockOutOpen, setClockOutOpen] = useState(false);

  const clockIn = trpc.dtr.attendanceClockIn.useMutation({
    onSuccess: () => {
      toast.success("Clocked in successfully.");
      router.refresh();
      setClockInOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setClockInOpen(false);
    },
  });

  const clockOut = trpc.dtr.attendanceClockOut.useMutation({
    onSuccess: () => {
      toast.success("Clocked out successfully.");
      router.refresh();
      setClockOutOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setClockOutOpen(false);
    },
  });

  async function getCoords(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve) => {
      if (navigator.geolocation === undefined) {
        resolve({ lat: 0, lng: 0 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: 0, lng: 0 }),
        { timeout: 5000 },
      );
    });
  }

  async function handleClockIn() {
    const { lat, lng } = await getCoords();
    clockIn.mutate({ employeeId, lat, lng });
  }

  async function handleClockOut() {
    if (attendanceId === null) return;
    const { lat, lng } = await getCoords();
    clockOut.mutate({ attendanceId, lat, lng });
  }

  // No record today — show Clock In
  if (attendanceId === null) {
    return (
      <Dialog open={clockInOpen} onOpenChange={setClockInOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Clock In
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Clock In</DialogTitle>
            <DialogDescription>
              Record your arrival time. Your location will be captured if
              permitted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClockInOpen(false)}
              disabled={clockIn.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={handleClockIn}
              disabled={clockIn.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {clockIn.isPending ? "Clocking in…" : "Confirm Clock In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Already clocked out — nothing for the employee to do
  if (hasClockedOut) {
    return null;
  }

  // Clocked in, not yet clocked out — show Clock Out
  return (
    <Dialog open={clockOutOpen} onOpenChange={setClockOutOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
        >
          Clock Out
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Clock Out</DialogTitle>
          <DialogDescription>
            Record your departure time. Your location will be captured if
            permitted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClockOutOpen(false)}
            disabled={clockOut.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={handleClockOut}
            disabled={clockOut.isPending}
            className="bg-amber-500 text-white hover:bg-amber-600"
          >
            {clockOut.isPending ? "Clocking out…" : "Confirm Clock Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
