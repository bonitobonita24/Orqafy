import { z } from "zod";

export const vendorTypeSchema = z.enum(["direct_supplier", "ecommerce_seller"]);

export const vendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: vendorTypeSchema,
  contactPerson: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  tinNumber: z.string().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const directSupplierSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  paymentTermsDays: z.number().int().nullable(),
  bankName: z.string().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankAccountName: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const eCommerceSellerSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  platform: z.string(),
  shopUrl: z.string().nullable(),
  shopName: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const purchaseOrderStatusSchema = z.enum([
  "draft",
  "submitted",
  "approved",
  "partially_received",
  "received",
  "cancelled",
]);

export const purchaseOrderSchema = z.object({
  id: z.string(),
  poNumber: z.string(),
  vendorId: z.string(),
  status: purchaseOrderStatusSchema,
  orderDate: z.coerce.date(),
  expectedDeliveryDate: z.coerce.date().nullable(),
  subtotal: z.number(),
  taxAmount: z.number(),
  totalAmount: z.number(),
  shippingCostTotal: z.number(),
  currency: z.string(),
  notes: z.string().nullable(),
  approvedById: z.string().nullable(),
  approvedAt: z.coerce.date().nullable(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const purchaseOrderItemSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  productId: z.string(),
  quantity: z.number(),
  receivedQuantity: z.number(),
  unitPrice: z.number(),
  computedUnitCost: z.number(),
  manualUnitCostOverride: z.number().nullable(),
  effectiveUnitCost: z.number(),
  distributedShippingCost: z.number(),
  landedUnitCost: z.number(),
  totalPrice: z.number(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const allocationTypeSchema = z.enum([
  "stock",
  "project_expense",
  "company_expense",
]);

export const purchaseOrderItemAllocationSchema = z.object({
  id: z.string(),
  purchaseOrderItemId: z.string(),
  allocationType: allocationTypeSchema,
  quantity: z.number(),
  warehouseId: z.string().nullable(),
  projectId: z.string().nullable(),
  expenseCategoryId: z.string().nullable(),
  actualUnitCostAtPurchase: z.number(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const shippingCostSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  description: z.string(),
  amount: z.number(),
  currency: z.string(),
  trackingNumber: z.string().nullable(),
  carrier: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const shippingDistributionMethodSchema = z.enum([
  "equal_share",
  "proportional_by_cost",
]);

export const shippingCostDistributionSchema = z.object({
  id: z.string(),
  shippingCostId: z.string(),
  purchaseOrderItemId: z.string(),
  method: shippingDistributionMethodSchema,
  distributedAmount: z.number(),
  createdAt: z.coerce.date(),
});

export const goodsReceiptStatusSchema = z.enum([
  "pending",
  "inspecting",
  "accepted",
  "rejected",
]);

export const goodsReceiptSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  receiptNumber: z.string(),
  receivedDate: z.coerce.date(),
  status: goodsReceiptStatusSchema,
  receivedById: z.string(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const goodsReceiptItemSchema = z.object({
  id: z.string(),
  goodsReceiptId: z.string(),
  purchaseOrderItemId: z.string(),
  quantityReceived: z.number(),
  quantityAccepted: z.number(),
  quantityRejected: z.number(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const purchaseInvoiceStatusSchema = z.enum([
  "draft",
  "received",
  "paid",
  "void",
]);

export const purchaseInvoiceSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  vendorId: z.string(),
  invoiceNumber: z.string(),
  status: purchaseInvoiceStatusSchema,
  amount: z.number(),
  currency: z.string(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  paidAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
