export type VendorType = "direct_supplier" | "ecommerce_seller";

export type Vendor = {
  id: string;
  name: string;
  type: VendorType;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  tinNumber: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type DirectSupplier = {
  id: string;
  vendorId: string;
  paymentTermsDays: number | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ECommerceSeller = {
  id: string;
  vendorId: string;
  platform: string;
  shopUrl: string | null;
  shopName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "partially_received"
  | "received"
  | "cancelled";

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  vendorId: string;
  status: PurchaseOrderStatus;
  orderDate: Date;
  expectedDeliveryDate: Date | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  shippingCostTotal: number;
  currency: string;
  notes: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PurchaseOrderItem = {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  computedUnitCost: number;
  manualUnitCostOverride: number | null;
  effectiveUnitCost: number;
  distributedShippingCost: number;
  landedUnitCost: number;
  totalPrice: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AllocationType = "stock" | "project_expense" | "company_expense";

export type PurchaseOrderItemAllocation = {
  id: string;
  purchaseOrderItemId: string;
  allocationType: AllocationType;
  quantity: number;
  warehouseId: string | null;
  projectId: string | null;
  expenseCategoryId: string | null;
  actualUnitCostAtPurchase: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ShippingCost = {
  id: string;
  purchaseOrderId: string;
  description: string;
  amount: number;
  currency: string;
  trackingNumber: string | null;
  carrier: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ShippingDistributionMethod = "equal_share" | "proportional_by_cost";

export type ShippingCostDistribution = {
  id: string;
  shippingCostId: string;
  purchaseOrderItemId: string;
  method: ShippingDistributionMethod;
  distributedAmount: number;
  createdAt: Date;
};

export type GoodsReceiptStatus = "pending" | "inspecting" | "accepted" | "rejected";

export type GoodsReceipt = {
  id: string;
  purchaseOrderId: string;
  receiptNumber: string;
  receivedDate: Date;
  status: GoodsReceiptStatus;
  receivedById: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GoodsReceiptItem = {
  id: string;
  goodsReceiptId: string;
  purchaseOrderItemId: string;
  quantityReceived: number;
  quantityAccepted: number;
  quantityRejected: number;
  notes: string | null;
  createdAt: Date;
};

export type PurchaseInvoiceStatus = "draft" | "received" | "paid" | "void";

export type PurchaseInvoice = {
  id: string;
  purchaseOrderId: string;
  vendorId: string;
  invoiceNumber: string;
  status: PurchaseInvoiceStatus;
  amount: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};
