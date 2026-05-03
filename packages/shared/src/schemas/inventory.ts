import { z } from "zod";

export const markupModeSchema = z.enum(["percentage", "ceiling"]);

export const productSchema = z.object({
  id: z.string(),
  sku: z.string(),
  barcode: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  categoryId: z.string().nullable(),
  unit: z.string(),
  basePrice: z.number(),
  tier1Price: z.number(),
  tier1MarkupMode: markupModeSchema,
  tier1MarkupValue: z.number(),
  tier2Price: z.number(),
  tier2MarkupMode: markupModeSchema,
  tier2MarkupValue: z.number(),
  tier3Price: z.number(),
  tier3MarkupMode: markupModeSchema,
  tier3MarkupValue: z.number(),
  costPrice: z.number(),
  requiresSerialNumber: z.boolean(),
  isEcommerceEnabled: z.boolean(),
  ecommerceTitle: z.string().nullable(),
  ecommerceDescription: z.string().nullable(),
  ecommerceImageUrls: z.array(z.string()),
  minStockLevel: z.number(),
  maxStockLevel: z.number().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const serialNumberStatusSchema = z.enum([
  "in_stock",
  "sold",
  "disbursed_to_project",
  "transferred",
  "written_off",
]);

export const productSerialNumberSchema = z.object({
  id: z.string(),
  productId: z.string(),
  serialNumber: z.string(),
  status: serialNumberStatusSchema,
  warehouseId: z.string().nullable(),
  purchaseOrderItemId: z.string().nullable(),
  soldAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const productPurchaseHistorySchema = z.object({
  id: z.string(),
  productId: z.string(),
  purchaseOrderItemId: z.string(),
  vendorId: z.string(),
  quantity: z.number(),
  unitCost: z.number(),
  landedUnitCost: z.number(),
  purchaseDate: z.coerce.date(),
  createdAt: z.coerce.date(),
});

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  parentId: z.string().nullable(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const warehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  address: z.string().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const warehouseStockSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  productId: z.string(),
  quantity: z.number(),
  reservedQuantity: z.number(),
  availableQuantity: z.number(),
  updatedAt: z.coerce.date(),
});

export const stockMovementTypeSchema = z.enum([
  "in",
  "out",
  "adjustment",
  "transfer",
]);

export const stockMovementSchema = z.object({
  id: z.string(),
  productId: z.string(),
  warehouseId: z.string(),
  destinationWarehouseId: z.string().nullable(),
  type: stockMovementTypeSchema,
  quantity: z.number(),
  serialNumberIds: z.array(z.string()),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  reason: z.string().nullable(),
  performedById: z.string(),
  createdAt: z.coerce.date(),
});

export const disbursementStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "completed",
]);

export const inventoryDisbursementSchema = z.object({
  id: z.string(),
  disbursementNumber: z.string(),
  projectId: z.string(),
  warehouseId: z.string(),
  status: disbursementStatusSchema,
  requestedById: z.string(),
  approvedById: z.string().nullable(),
  approvedAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const inventoryDisbursementItemSchema = z.object({
  id: z.string(),
  disbursementId: z.string(),
  productId: z.string(),
  requestedQuantity: z.number(),
  approvedQuantity: z.number().nullable(),
  disbursedQuantity: z.number(),
  serialNumberIds: z.array(z.string()),
  unitCostAtDisbursement: z.number(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});
