"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CUSTOMER_TIERS = ["regular", "vip", "authorized_dealer"] as const;
type CustomerTier = (typeof CUSTOMER_TIERS)[number];

const TIER_LABELS: Record<CustomerTier, string> = {
  regular: "Regular",
  vip: "VIP",
  authorized_dealer: "Authorized Dealer",
};

interface ClientFormValues {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  taxId: string;
  tier: CustomerTier;
  notes: string;
}

interface ClientFormCreateProps {
  slug: string;
  mode: "create";
}

interface ClientFormEditProps {
  slug: string;
  mode: "edit";
  clientId: string;
  initialValues: {
    firstName: string;
    lastName: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    taxId: string | null;
    tier: string;
    notes: string | null;
  };
}

type Props = ClientFormCreateProps | ClientFormEditProps;

function empty(v: string | null | undefined): string {
  return v ?? "";
}

export function ClientForm(props: Props) {
  const router = useRouter();

  const [values, setValues] = useState<ClientFormValues>(() => {
    if (props.mode === "edit") {
      return {
        firstName: props.initialValues.firstName,
        lastName: props.initialValues.lastName,
        companyName: empty(props.initialValues.companyName),
        email: empty(props.initialValues.email),
        phone: empty(props.initialValues.phone),
        address: empty(props.initialValues.address),
        city: empty(props.initialValues.city),
        province: empty(props.initialValues.province),
        postalCode: empty(props.initialValues.postalCode),
        taxId: empty(props.initialValues.taxId),
        tier: (CUSTOMER_TIERS as readonly string[]).includes(props.initialValues.tier)
          ? (props.initialValues.tier as CustomerTier)
          : "regular",
        notes: empty(props.initialValues.notes),
      };
    }
    return {
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
      taxId: "",
      tier: "regular",
      notes: "",
    };
  });

  const [error, setError] = useState<string | null>(null);

  const set =
    (field: keyof ClientFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const createMutation = trpc.client.create.useMutation({
    onSuccess: (created) => {
      toast.success("Client created.");
      router.push(`/${props.slug}/clients`);
    },
    onError: (err) => {
      setError(err.message);
      toast.error("Failed to create client.");
    },
  });

  const updateMutation = trpc.client.update.useMutation({
    onSuccess: () => {
      toast.success("Client updated.");
      router.push(`/${props.slug}/clients`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error("Failed to update client.");
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function submit() {
    setError(null);
    if (values.firstName.trim().length === 0) {
      setError("First name is required.");
      return;
    }
    if (values.lastName.trim().length === 0) {
      setError("Last name is required.");
      return;
    }

    const base = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      ...(values.companyName.trim() ? { companyName: values.companyName.trim() } : {}),
      ...(values.email.trim() ? { email: values.email.trim() } : {}),
      ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
      ...(values.address.trim() ? { address: values.address.trim() } : {}),
      ...(values.city.trim() ? { city: values.city.trim() } : {}),
      ...(values.province.trim() ? { province: values.province.trim() } : {}),
      ...(values.postalCode.trim() ? { postalCode: values.postalCode.trim() } : {}),
      ...(values.taxId.trim() ? { taxId: values.taxId.trim() } : {}),
      tier: values.tier,
      ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
    };

    if (props.mode === "edit") {
      updateMutation.mutate({ id: props.clientId, ...base });
    } else {
      createMutation.mutate(base);
    }
  }

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {error !== null && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Identity
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              First Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={values.firstName}
              onChange={set("firstName")}
              className={inputCls}
              maxLength={100}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Last Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={values.lastName}
              onChange={set("lastName")}
              className={inputCls}
              maxLength={100}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Company Name</label>
          <input
            type="text"
            value={values.companyName}
            onChange={set("companyName")}
            className={inputCls}
            maxLength={200}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tax ID</label>
          <input
            type="text"
            value={values.taxId}
            onChange={set("taxId")}
            className={inputCls}
            maxLength={50}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tier</label>
          <Select
            value={values.tier}
            onValueChange={(v) =>
              setValues((prev) => ({ ...prev, tier: v as CustomerTier }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_TIERS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIER_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Contact
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              value={values.email}
              onChange={set("email")}
              className={inputCls}
              maxLength={255}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Phone</label>
            <input
              type="tel"
              value={values.phone}
              onChange={set("phone")}
              className={inputCls}
              maxLength={30}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Address
        </h2>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Street Address</label>
          <input
            type="text"
            value={values.address}
            onChange={set("address")}
            className={inputCls}
            maxLength={500}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">City</label>
            <input
              type="text"
              value={values.city}
              onChange={set("city")}
              className={inputCls}
              maxLength={100}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Province</label>
            <input
              type="text"
              value={values.province}
              onChange={set("province")}
              className={inputCls}
              maxLength={100}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Postal Code</label>
            <input
              type="text"
              value={values.postalCode}
              onChange={set("postalCode")}
              className={inputCls}
              maxLength={20}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Notes
        </h2>
        <textarea
          value={values.notes}
          onChange={set("notes")}
          className={`${inputCls} min-h-[100px] resize-y`}
          maxLength={1000}
          placeholder="Optional notes…"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending
            ? props.mode === "edit"
              ? "Saving…"
              : "Creating…"
            : props.mode === "edit"
              ? "Save Changes"
              : "Create Client"}
        </button>
      </div>
    </div>
  );
}
