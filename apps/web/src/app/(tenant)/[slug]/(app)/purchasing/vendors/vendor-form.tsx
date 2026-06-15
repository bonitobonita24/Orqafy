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

type VendorType = "direct" | "ecommerce";

interface VendorFormProps {
  slug: string;
  mode: "create" | "edit";
  vendorId?: string;
  initial?: {
    type?: VendorType;
    companyName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    platformUrl?: string;
    platformName?: string;
    paymentTerms?: string;
    notes?: string;
  };
}

export function VendorForm({ slug, mode, vendorId, initial = {} }: VendorFormProps) {
  const router = useRouter();

  const [type, setType] = useState<VendorType>(initial.type ?? "direct");
  const [companyName, setCompanyName] = useState(initial.companyName ?? "");
  const [contactName, setContactName] = useState(initial.contactName ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [platformUrl, setPlatformUrl] = useState(initial.platformUrl ?? "");
  const [platformName, setPlatformName] = useState(initial.platformName ?? "");
  const [paymentTerms, setPaymentTerms] = useState(initial.paymentTerms ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const createMut = trpc.purchasing.vendor.create.useMutation({
    onSuccess: (data) => {
      toast.success("Vendor created.");
      router.push(`/${slug}/purchasing/vendors`);
      router.refresh();
      void data;
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const updateMut = trpc.purchasing.vendor.update.useMutation({
    onSuccess: () => {
      toast.success("Vendor updated.");
      router.push(`/${slug}/purchasing/vendors`);
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

    if (companyName.trim() === "") {
      setError("Company name is required.");
      return;
    }
    if (email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    const payload = {
      type,
      companyName: companyName.trim(),
      ...(contactName.trim() !== "" ? { contactName: contactName.trim() } : {}),
      ...(email.trim() !== "" ? { email: email.trim() } : {}),
      ...(phone.trim() !== "" ? { phone: phone.trim() } : {}),
      ...(address.trim() !== "" ? { address: address.trim() } : {}),
      ...(platformUrl.trim() !== "" ? { platformUrl: platformUrl.trim() } : {}),
      ...(platformName.trim() !== "" ? { platformName: platformName.trim() } : {}),
      ...(paymentTerms.trim() !== "" ? { paymentTerms: paymentTerms.trim() } : {}),
      ...(notes.trim() !== "" ? { notes: notes.trim() } : {}),
    };

    if (mode === "create") {
      createMut.mutate(payload);
    } else {
      if (vendorId === undefined) return;
      updateMut.mutate({ id: vendorId, ...payload });
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
        {/* Vendor Type */}
        <div className="space-y-2">
          <Label htmlFor="type">Vendor Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as VendorType)}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct Supplier</SelectItem>
              <SelectItem value="ecommerce">E-commerce Seller</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="companyName">
            Company Name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Supplies Co."
            required
          />
        </div>

        {/* Contact Person */}
        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Person</Label>
          <Input
            id="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Juan dela Cruz"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vendor@example.com"
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+63 912 345 6789"
          />
        </div>

        {/* Payment Terms */}
        <div className="space-y-2">
          <Label htmlFor="paymentTerms">Payment Terms</Label>
          <Input
            id="paymentTerms"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="Net 30"
          />
        </div>

        {/* Platform fields — show for ecommerce type */}
        {type === "ecommerce" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="platformName">Platform Name</Label>
              <Input
                id="platformName"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                placeholder="Shopee, Lazada, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platformUrl">Platform URL</Label>
              <Input
                id="platformUrl"
                type="url"
                value={platformUrl}
                onChange={(e) => setPlatformUrl(e.target.value)}
                placeholder="https://shopee.ph/store/..."
              />
            </div>
          </>
        )}
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St, City, Province"
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes about this vendor…"
          rows={3}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Vendor" : "Update Vendor"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${slug}/purchasing/vendors`)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
