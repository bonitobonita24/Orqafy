"use client";

/**
 * PrivacyClient — DSR self-service UI — V32.9 / RA 10173
 *
 * Lets data subjects exercise their 6 rights directly from within the app:
 *   access · port · rectify · requestErasure · object · myRequests
 *
 * Primitives used: Button, Card, Input, Label, AlertDialog, Textarea (all exist
 * in @/components/ui). Dialog is available but AlertDialog covers the confirm
 * patterns needed here.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | Date | null | undefined) {
  if (d == null) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    received: "Received",
    in_progress: "In Progress",
    completed: "Completed",
    rejected: "Rejected",
  };
  return map[s] ?? s;
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    access: "Access",
    erase: "Erasure",
    port: "Portability",
    rectify: "Rectification",
    object: "Objection",
  };
  return map[t] ?? t;
}

// ─── Section: View my data ────────────────────────────────────────────────────

function ViewMyData() {
  const { data, isLoading, error } = trpc.dsr.access.useQuery();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your data…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error.message ?? "Could not load your data. Please try again."}
      </p>
    );
  }

  if (!data) return null;

  const { subject, employee } = data;

  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="font-medium">{subject.email}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Display name</p>
          <p className="font-medium">{subject.displayName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">First name</p>
          <p className="font-medium">{subject.firstName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Last name</p>
          <p className="font-medium">{subject.lastName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Phone</p>
          <p className="font-medium">{subject.phone ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Member since</p>
          <p className="font-medium">{formatDate(subject.createdAt)}</p>
        </div>
      </div>

      {employee && (
        <div className="mt-2 rounded-md border border-border bg-muted/20 px-4 py-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Employee record
          </p>
          <div className="grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
            <span>
              <span className="text-muted-foreground">Position: </span>
              {(employee as { position?: string }).position ?? "—"}
            </span>
            <span>
              <span className="text-muted-foreground">Status: </span>
              {(employee as { status?: string }).status ?? "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Export my data ──────────────────────────────────────────────────

function ExportMyData() {
  const utils = trpc.useUtils();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const data = await utils.dsr.access.fetch();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data export has been downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Download a machine-readable copy of your personal data (Right to Data Portability —
        Section 18, RA 10173).
      </p>
      <Button
        onClick={() => void handleExport()}
        disabled={exporting}
        variant="outline"
        className="text-sm"
      >
        {exporting ? "Preparing export…" : "Download my data (JSON)"}
      </Button>
    </div>
  );
}

// ─── Section: Correct my profile ─────────────────────────────────────────────

function CorrectMyProfile() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");

  const rectifyMut = trpc.dsr.rectify.useMutation({
    onSuccess: () => {
      toast.success("Your profile has been updated.");
      void utils.dsr.access.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
      phone?: string;
    } = {};
    if (firstName.trim()) payload.firstName = firstName.trim();
    if (lastName.trim()) payload.lastName = lastName.trim();
    if (displayName.trim()) payload.displayName = displayName.trim();
    if (phone.trim()) payload.phone = phone.trim();

    if (Object.keys(payload).length === 0) {
      toast.error("Enter at least one field to update.");
      return;
    }
    rectifyMut.mutate(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Correct inaccurate personal data (Section 16, RA 10173). Fill in only the fields you want
        to change.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rectify-firstName">First name</Label>
          <Input
            id="rectify-firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="New first name"
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rectify-lastName">Last name</Label>
          <Input
            id="rectify-lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="New last name"
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rectify-displayName">Display name</Label>
          <Input
            id="rectify-displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="New display name"
            maxLength={150}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rectify-phone">Phone</Label>
          <Input
            id="rectify-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+63 …"
            maxLength={30}
          />
        </div>
      </div>
      <Button type="submit" disabled={rectifyMut.isPending} className="text-sm">
        {rectifyMut.isPending ? "Saving…" : "Save corrections"}
      </Button>
    </form>
  );
}

// ─── Section: Request erasure ─────────────────────────────────────────────────

function RequestErasure() {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  const erasureMut = trpc.dsr.requestErasure.useMutation({
    onSuccess: () => {
      toast.success("Erasure request submitted. Our DPO will review it within 15 business days.");
      setOpen(false);
      setReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Request that we erase your personal data (Section 16, RA 10173). Because Orqafy processes
        payroll and employment records subject to statutory retention periods (BIR: 7 years), this
        is a <strong>reviewed request</strong> — data is not deleted automatically. Our DPO will
        assess and respond within 15 business days.
      </p>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="text-sm">
            Request data erasure
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request data erasure</AlertDialogTitle>
            <AlertDialogDescription>
              Your request will be reviewed by our DPO. Records required by Philippine law (BIR,
              SSS, etc.) cannot be deleted until their statutory retention period expires.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 py-2">
            <Label htmlFor="erasure-reason">Reason (optional)</Label>
            <Textarea
              id="erasure-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you requesting erasure?"
              maxLength={1000}
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => erasureMut.mutate({ reason: reason || undefined })}
              disabled={erasureMut.isPending}
            >
              {erasureMut.isPending ? "Submitting…" : "Submit request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Section: Object to processing ───────────────────────────────────────────

function ObjectToProcessing() {
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const objectMut = trpc.dsr.object.useMutation({
    onSuccess: () => {
      toast.success("Objection submitted. Our DPO will review it within 15 business days.");
      setSubmitted(true);
      setReason("");
      setScope("");
    },
    onError: (err) => toast.error(err.message),
  });

  if (submitted) {
    return (
      <p className="text-sm text-muted-foreground">
        Your objection has been received. You can submit another if needed.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        objectMut.mutate({
          reason: reason || undefined,
          scope: scope || undefined,
        });
      }}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">
        Object to processing of your personal data for specific purposes (Section 34, RA 10173).
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="object-scope">Processing activity / scope</Label>
        <Input
          id="object-scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="e.g. marketing, analytics"
          maxLength={200}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="object-reason">Reason</Label>
        <Textarea
          id="object-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why do you object to this processing?"
          maxLength={1000}
          rows={3}
        />
      </div>
      <Button type="submit" disabled={objectMut.isPending} variant="outline" className="text-sm">
        {objectMut.isPending ? "Submitting…" : "Submit objection"}
      </Button>
    </form>
  );
}

// ─── Section: My requests ─────────────────────────────────────────────────────

function MyRequests() {
  const { data, isLoading, error } = trpc.dsr.myRequests.useQuery();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your requests…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error.message ?? "Could not load requests."}
      </p>
    );
  }

  const requests = data ?? [];

  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You have not submitted any data subject requests yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm"
        >
          <div className="space-y-0.5">
            <p className="font-medium">{typeLabel(r.type)}</p>
            <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              r.status === "completed"
                ? "bg-green-500/10 text-green-600"
                : r.status === "rejected"
                  ? "bg-destructive/10 text-destructive"
                  : r.status === "in_progress"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
            }`}
          >
            {statusLabel(r.status)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Root client component ────────────────────────────────────────────────────

export function PrivacyClient() {
  return (
    <div className="space-y-6">
      {/* View my data */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">My personal data</h2>
          <p className="text-xs text-muted-foreground">Right to access — Section 16, RA 10173</p>
        </div>
        <ViewMyData />
      </Card>

      {/* Export */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Export my data</h2>
          <p className="text-xs text-muted-foreground">Right to data portability — Section 18, RA 10173</p>
        </div>
        <ExportMyData />
      </Card>

      {/* Correct */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Correct my profile</h2>
          <p className="text-xs text-muted-foreground">Right to rectification — Section 16, RA 10173</p>
        </div>
        <CorrectMyProfile />
      </Card>

      {/* Erasure */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Request data erasure</h2>
          <p className="text-xs text-muted-foreground">Right to erasure — Section 16, RA 10173</p>
        </div>
        <RequestErasure />
      </Card>

      {/* Object */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Object to processing</h2>
          <p className="text-xs text-muted-foreground">Right to object — Section 34, RA 10173</p>
        </div>
        <ObjectToProcessing />
      </Card>

      {/* My requests */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">My requests</h2>
          <p className="text-xs text-muted-foreground">All data subject requests you have submitted</p>
        </div>
        <MyRequests />
      </Card>
    </div>
  );
}
