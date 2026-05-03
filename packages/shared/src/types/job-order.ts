export type JobOrderStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "verified"
  | "invoiced"
  | "cancelled"
  | "warranty_claim"
  | "returned";

export type JobOrder = {
  id: string;
  customerId: string;
  projectId: string | null;
  assignedToId: string | null;
  title: string;
  description: string | null;
  status: JobOrderStatus;
  priority: string;
  scheduledDate: Date | null;
  completedDate: Date | null;
  partsUsed: Record<string, unknown>[];
  laborHours: number | null;
  laborCost: number | null;
  totalCost: number | null;
  intakeSignatureUrl: string | null;
  intakeSignedAt: Date | null;
  releaseSignatureUrl: string | null;
  releaseSignedAt: Date | null;
  invoiceId: string | null;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};
