export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";

export type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  customerId: string | null;
  assignedToId: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TicketComment = {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
};

export type TicketAttachment = {
  id: string;
  ticketId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploadedAt: Date;
};
