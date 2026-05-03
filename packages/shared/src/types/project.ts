export type ProjectStatus = "draft" | "active" | "on_hold" | "completed" | "cancelled";

export type Project = {
  id: string;
  customerId: string;
  name: string;
  description: string | null;
  budget: number;
  startDate: Date;
  endDate: Date;
  status: ProjectStatus;
  managerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Milestone = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueDate: Date;
  isCompleted: boolean;
  isAutoCompleted: boolean;
  completedAt: Date | null;
  completedOverrideById: string | null;
  createdAt: Date;
};

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  milestoneId: string | null;
  parentTaskId: string | null;
  assignedById: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskAssignment = {
  id: string;
  taskId: string;
  userId: string;
  assignedAt: Date;
  assignedById: string;
  removedAt: Date | null;
};

export type TaskAttachment = {
  id: string;
  taskId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploadedAt: Date;
};

export type TaskStatusReport = {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  attachmentUrls: string[] | null;
  createdAt: Date;
};

export type TimeLog = {
  id: string;
  projectId: string;
  taskId: string;
  userId: string;
  hours: number;
  description: string;
  loggedAt: Date;
};

export type ProjectExpenseCostType = "direct" | "inventory_consumed";
export type ProjectExpenseStatus = "draft" | "approved" | "rejected";

export type ProjectExpense = {
  id: string;
  projectId: string;
  cashAdvanceId: string | null;
  inventoryDisbursementItemId: string | null;
  expenseCategoryId: string;
  amount: number;
  description: string;
  receiptUrl: string | null;
  fundSourceId: string | null;
  costType: ProjectExpenseCostType;
  loggedById: string;
  status: ProjectExpenseStatus;
  createdAt: Date;
};

export type ProjectNote = {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  content: Record<string, unknown>;
  createdById: string;
  updatedById: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectNoteAttachment = {
  id: string;
  projectNoteId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploadedAt: Date;
};

export type ToDo = {
  id: string;
  title: string;
  description: string | null;
  assignedToId: string | null;
  dueDate: Date | null;
  isCompleted: boolean;
  completedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ToDoAttachment = {
  id: string;
  toDoId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploadedAt: Date;
};
