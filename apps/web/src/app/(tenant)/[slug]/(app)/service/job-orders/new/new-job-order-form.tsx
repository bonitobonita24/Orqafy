"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  email: string | null;
}

interface NewJobOrderFormProps {
  slug: string;
  customers: Customer[];
}

function customerLabel(c: Customer): string {
  const company = c.companyName?.trim();
  if (company !== undefined && company.length > 0) return company;
  return `${c.firstName} ${c.lastName}`.trim();
}

export function NewJobOrderForm({
  slug,
  customers,
}: NewJobOrderFormProps): React.ReactElement {
  const router = useRouter();

  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reportedIssue, setReportedIssue] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [deviceType, setDeviceType] = useState("");
  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [warranty, setWarranty] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMut = trpc.jobOrder.create.useMutation({
    onSuccess: (jo) => {
      toast.success(`Job order ${jo.jobOrderNumber} created.`);
      router.push(`/${slug}/service/job-orders/${jo.id}`);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const fieldClass =
    "mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-primary";

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError("Customer is required.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!reportedIssue.trim()) {
      setError("Reported issue is required.");
      return;
    }

    const estimatedCostNum =
      estimatedCost.trim() !== "" ? parseFloat(estimatedCost) : undefined;
    if (
      estimatedCost.trim() !== "" &&
      (Number.isNaN(estimatedCostNum) ||
        (estimatedCostNum !== undefined && estimatedCostNum < 0))
    ) {
      setError("Estimated cost must be a non-negative number.");
      return;
    }

    createMut.mutate({
      customerId,
      title: title.trim(),
      description: description.trim(),
      reportedIssue: reportedIssue.trim(),
      priority,
      ...(deviceType.trim() !== "" ? { deviceType: deviceType.trim() } : {}),
      ...(deviceBrand.trim() !== "" ? { deviceBrand: deviceBrand.trim() } : {}),
      ...(deviceModel.trim() !== "" ? { deviceModel: deviceModel.trim() } : {}),
      ...(serialNumber.trim() !== "" ? { serialNumber: serialNumber.trim() } : {}),
      ...(estimatedCostNum !== undefined ? { estimatedCost: estimatedCostNum } : {}),
      ...(warranty.trim() !== "" ? { warranty: warranty.trim() } : {}),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-5 rounded-lg border border-border bg-card p-6"
    >
      {error !== null && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Customer */}
      <label className="block text-sm">
        <span className="font-medium">
          Customer <span className="text-red-400">*</span>
        </span>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className={fieldClass}
          required
        >
          <option value="">— Select a customer —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {customerLabel(c)}
              {c.email !== null ? ` (${c.email})` : ""}
            </option>
          ))}
        </select>
      </label>

      {/* Title */}
      <label className="block text-sm">
        <span className="font-medium">
          Title <span className="text-red-400">*</span>
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short description of the repair / service"
          maxLength={500}
          className={fieldClass}
        />
      </label>

      {/* Reported Issue */}
      <label className="block text-sm">
        <span className="font-medium">
          Reported Issue <span className="text-red-400">*</span>
        </span>
        <textarea
          value={reportedIssue}
          onChange={(e) => setReportedIssue(e.target.value)}
          placeholder="What the customer reports is wrong…"
          rows={3}
          maxLength={2000}
          className={fieldClass}
        />
      </label>

      {/* Description */}
      <label className="block text-sm">
        <span className="font-medium">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional internal notes (optional)"
          rows={3}
          maxLength={2000}
          className={fieldClass}
        />
      </label>

      {/* Priority */}
      <label className="block text-sm">
        <span className="font-medium">Priority</span>
        <select
          value={priority}
          onChange={(e) =>
            setPriority(e.target.value as "low" | "medium" | "high" | "urgent")
          }
          className={fieldClass}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>

      {/* Device Info */}
      <fieldset className="rounded-md border border-border p-4">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          Device Information (optional)
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Type</span>
            <input
              type="text"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
              placeholder="e.g. Laptop, Phone, Printer"
              maxLength={100}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Brand</span>
            <input
              type="text"
              value={deviceBrand}
              onChange={(e) => setDeviceBrand(e.target.value)}
              placeholder="e.g. Lenovo, Apple"
              maxLength={100}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Model</span>
            <input
              type="text"
              value={deviceModel}
              onChange={(e) => setDeviceModel(e.target.value)}
              placeholder="e.g. ThinkPad X1 Carbon"
              maxLength={100}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Serial No.</span>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Device serial number"
              maxLength={100}
              className={`${fieldClass} font-mono`}
            />
          </label>
        </div>
      </fieldset>

      {/* Costs + Warranty */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Estimated Cost</span>
          <input
            type="number"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            placeholder="0.00"
            min={0}
            step="0.01"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Warranty</span>
          <input
            type="text"
            value={warranty}
            onChange={(e) => setWarranty(e.target.value)}
            placeholder="e.g. 30-day parts warranty"
            maxLength={200}
            className={fieldClass}
          />
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={createMut.isPending}
          className="rounded-md border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          {createMut.isPending ? "Creating…" : "Create job order"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/${slug}/service/job-orders`)}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
