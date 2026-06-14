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

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  isPrimary: boolean;
}

interface ContactsPanelProps {
  customerId: string;
  initialContacts: Contact[];
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-[#00d992] focus:outline-none";

/* ── Add Contact Dialog ───────────────────────────────────────────────── */

function AddContactDialog({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setPosition("");
    setIsPrimary(false);
    setError(null);
  }

  const create = trpc.crm.contactCreate.useMutation({
    onSuccess: () => {
      toast.success("Contact added.");
      router.refresh();
      reset();
      setOpen(false);
    },
    onError: (err) => {
      setError(err.message);
      toast.error("Failed to add contact.");
    },
  });

  function submit() {
    setError(null);
    if (name.trim().length === 0) {
      setError("Name is required.");
      return;
    }
    create.mutate({
      customerId,
      name: name.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(position.trim() ? { position: position.trim() } : {}),
      isPrimary,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-md border border-[#00d992]/40 bg-[#00d992]/10 px-3 py-1.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20"
        >
          + Add Contact
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Add a person associated with this customer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Name <span className="text-red-400">*</span>
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} maxLength={255} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Position</label>
            <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls} maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} maxLength={255} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} maxLength={50} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="accent-[#00d992]"
            />
            Primary contact
          </label>
          {error !== null && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={create.isPending}
            onClick={submit}
            className="rounded-md border border-[#00d992]/40 bg-[#00d992]/10 px-3 py-1.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {create.isPending ? "Saving…" : "Add Contact"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Edit Contact Dialog ──────────────────────────────────────────────── */

function EditContactDialog({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [position, setPosition] = useState(contact.position ?? "");
  const [isPrimary, setIsPrimary] = useState(contact.isPrimary);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(contact.name);
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setPosition(contact.position ?? "");
    setIsPrimary(contact.isPrimary);
    setError(null);
  }

  const update = trpc.crm.contactUpdate.useMutation({
    onSuccess: () => {
      toast.success("Contact updated.");
      router.refresh();
      setOpen(false);
    },
    onError: (err) => {
      setError(err.message);
      toast.error("Failed to update contact.");
    },
  });

  function submit() {
    setError(null);
    if (name.trim().length === 0) {
      setError("Name is required.");
      return;
    }
    update.mutate({
      id: contact.id,
      name: name.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(position.trim() ? { position: position.trim() } : {}),
      isPrimary,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Edit
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>Update contact details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Name <span className="text-red-400">*</span>
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} maxLength={255} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Position</label>
            <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls} maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} maxLength={255} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} maxLength={50} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="accent-[#00d992]"
            />
            Primary contact
          </label>
          {error !== null && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={update.isPending}
            onClick={submit}
            className="rounded-md border border-[#00d992]/40 bg-[#00d992]/10 px-3 py-1.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {update.isPending ? "Saving…" : "Save Changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Delete Contact Dialog ────────────────────────────────────────────── */

function DeleteContactDialog({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const del = trpc.crm.contactDelete.useMutation({
    onSuccess: () => {
      toast.success("Contact deleted.");
      router.refresh();
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20"
        >
          Delete
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete contact?</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{contact.name}</span> will be permanently removed.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={del.isPending}
            onClick={() => del.mutate({ id: contact.id })}
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {del.isPending ? "Deleting…" : "Yes, Delete"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Contacts Panel ───────────────────────────────────────────────────── */

export function ContactsPanel({ customerId, initialContacts }: ContactsPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold">
          Contacts
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {initialContacts.length}
          </span>
        </h2>
        <AddContactDialog customerId={customerId} />
      </div>
      {initialContacts.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-muted-foreground">
          No contacts added yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Position</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium sr-only">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialContacts.map((contact) => (
              <tr
                key={contact.id}
                className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{contact.name}</span>
                    {contact.isPrimary && (
                      <span className="rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#00d992]">
                        Primary
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {contact.position !== null ? contact.position : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {contact.email !== null ? contact.email : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {contact.phone !== null ? contact.phone : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <EditContactDialog contact={contact} />
                    <DeleteContactDialog contact={contact} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
