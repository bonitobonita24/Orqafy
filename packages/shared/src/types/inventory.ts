export type MarkupMode = "percentage" | "ceiling";

export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  unit: string;
  basePrice: number;
  tier1Price: number;
  tier1MarkupMode: MarkupMode;
  tier1MarkupValue: number;
  tier2Price: number;
  tier2MarkupMode: MarkupMode;
  tier2MarkupValue: number;
  tier3Price: number;
  tier3MarkupMode: MarkupMode;
  tier3MarkupValue: number;
  costPrice: number;
  requiresSerialNumber: boolean;
  isEcommerceEnabled: boolean;
  ecommerceTitle: string | null;
  ecommerceDescription: string | null;
  ecommerceImageUrls: string[];
  minStockLevel: number;
  maxStockLevel: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SerialNumberStatus =
  | "in_stock"
  | "sold"
  | "disbursed_to_project"
  | "transferred"
  | "written_off";

export type ProductSerialNumber = {
  id: string;
  productId: string;
  serialNumber: string;
  status: SerialNumberStatus;
  warehouseId: string | null;
  purchaseOrderItemId: string | null;
  soldAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductPurchaseHistory = {
  id: string;
  productId: string;
  purchaseOrderItemId: string;
  vendorId: string;
  quantity: number;
  unitCost: number;
  landedUnitCost: number;
  purchaseDate: Date;
  createdAt: Date;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Warehouse = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type WarehouseStock = {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  updatedAt: Date;
};

export type StockMovementType = "in" | "out" | "adjustment" | "transfer";

export type StockMovement = {
  id: string;
  productId: string;
  warehouseId: string;
  destinationWarehouseId: string | null;
  type: StockMovementType;
  quantity: number;
  serialNumberIds: string[];
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  performedById: string;
  createdAt: Date;
};

export type DisbursementStatus = "pending" | "approved" | "rejected" | "completed";

export type InventoryDisbursement = {
  id: string;
  disbursementNumber: string;
  projectId: string;
  warehouseId: string;
  status: DisbursementStatus;
  requestedById: string;
  approvedById: string | null;
  approvedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InventoryDisbursementItem = {
  id: string;
  disbursementId: string;
  productId: string;
  requestedQuantity: number;
  approvedQuantity: number | null;
  disbursedQuantity: number;
  serialNumberIds: string[];
  unitCostAtDisbursement: number;
  notes: string | null;
  createdAt: Date;
};
