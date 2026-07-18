/**
 * demo-ops-extras.ts
 *
 * Fills the remaining Purchasing / Inventory / Tasks / Invoice-payment
 * sub-features that demo-showcase.ts and demo-financials.ts leave empty:
 * invoice Payment rows, PO ShippingCost (+distribution), PO item
 * allocations, product serial numbers, product purchase history, a 2nd
 * warehouse, and task status reports.
 *
 * ── SAFE TO RE-RUN (idempotent) ────────────────────────────────────────────
 * Each sub-block is guarded independently by a per-tenant count of its OWN
 * primary model, so a partial prior run never duplicates rows and a missing
 * dependency (e.g. no received PO yet) just skips that block gracefully.
 * All FKs are resolved by query — nothing is hardcoded. Mirrors the style of
 * demo-showcase.ts.
 */

import type { PrismaClient } from '@prisma/client';
import { money, daysAgo, dateAgo, at, num, round2 } from './demo-seed-utils';

export async function seedOpsExtras(prisma: PrismaClient, tenantId: string): Promise<void> {
  await seedPayments(prisma, tenantId);
  await seedShippingCosts(prisma, tenantId);
  await seedPurchaseOrderItemAllocations(prisma, tenantId);
  await seedProductSerialNumbers(prisma, tenantId);
  await seedProductPurchaseHistory(prisma, tenantId);
  await seedSecondWarehouse(prisma, tenantId);
  await seedTaskStatusReports(prisma, tenantId);
}

// ── 1. Payment: recorded payments against paid / partially_paid invoices ────

async function seedPayments(prisma: PrismaClient, tenantId: string): Promise<void> {
  if ((await prisma.payment.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  Payments already seeded. Skipping.');
    return;
  }

  const invoices = await prisma.invoice.findMany({
    where: { tenantId, status: { in: ['paid', 'partially_paid'] } },
    select: { id: true, invoiceNumber: true, status: true, totalAmount: true, amountPaid: true, paidAt: true },
  });
  if (invoices.length === 0) {
    console.log('  ⏭  No paid/partially_paid invoices found — skipping payments.');
    return;
  }

  const methods = ['bank_transfer', 'gcash', 'cash', 'maya'];
  let count = 0;
  for (let i = 0; i < invoices.length; i++) {
    const inv = at(invoices, i);
    const total = Number(inv.totalAmount);
    const alreadyPaid = Number(inv.amountPaid);

    if (inv.status === 'paid') {
      // 1–2 payments summing to the full amount already recorded on the invoice.
      const splitInTwo = i % 2 === 0;
      if (splitInTwo) {
        const first = round2(total * 0.6);
        const second = round2(total - first);
        await prisma.payment.create({
          data: {
            tenantId,
            invoiceId: inv.id,
            amount: money(first),
            currency: 'PHP',
            method: at(methods, i),
            status: 'completed',
            referenceNumber: `BPI-REF-${num(8800 + i * 2)}`,
            notes: 'Partial settlement — first tranche.',
            paidAt: daysAgo(20 - i),
          },
        });
        await prisma.payment.create({
          data: {
            tenantId,
            invoiceId: inv.id,
            amount: money(second),
            currency: 'PHP',
            method: at(methods, i + 1),
            status: 'completed',
            referenceNumber: `BPI-REF-${num(8801 + i * 2)}`,
            notes: 'Partial settlement — final tranche.',
            paidAt: inv.paidAt ?? daysAgo(18 - i),
          },
        });
        count += 2;
      } else {
        await prisma.payment.create({
          data: {
            tenantId,
            invoiceId: inv.id,
            amount: money(total),
            currency: 'PHP',
            method: at(methods, i),
            status: 'completed',
            referenceNumber: `BPI-REF-${num(8842 + i)}`,
            notes: 'Full settlement.',
            paidAt: inv.paidAt ?? daysAgo(15 - i),
          },
        });
        count += 1;
      }
    } else {
      // partially_paid: one Payment matching the amountPaid already on the invoice.
      await prisma.payment.create({
        data: {
          tenantId,
          invoiceId: inv.id,
          amount: money(alreadyPaid),
          currency: 'PHP',
          method: at(methods, i),
          status: 'completed',
          referenceNumber: `GCASH-REF-${num(5500 + i)}`,
          notes: 'Partial payment received.',
          paidAt: daysAgo(6 - i),
        },
      });
      count += 1;
    }
  }
  console.log(`  ✅ Payments: ${count} recorded across ${invoices.length} invoices`);
}

// ── 2. ShippingCost + ShippingCostDistribution on a received PO ─────────────

async function seedShippingCosts(prisma: PrismaClient, tenantId: string): Promise<void> {
  if ((await prisma.shippingCost.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  Shipping costs already seeded. Skipping.');
    return;
  }

  const po = await prisma.purchaseOrder.findFirst({
    where: { tenantId, status: 'received' },
    select: {
      id: true,
      items: { select: { id: true, totalPrice: true } },
    },
  });
  if (!po || po.items.length === 0) {
    console.log('  ⏭  No received PO with items — skipping shipping costs.');
    return;
  }

  const shippingAmount = 4500;
  const itemsSubtotal = po.items.reduce((sum, it) => sum + Number(it.totalPrice), 0);

  const shippingCost = await prisma.shippingCost.create({
    data: {
      tenantId,
      purchaseOrderId: po.id,
      legNumber: 1,
      courierName: 'LBC Express',
      trackingNumber: `LBC-${num(778899)}`,
      cost: money(shippingAmount),
      currency: 'PHP',
      distributionMethod: 'proportional_by_cost',
      paidAt: daysAgo(6),
      notes: 'Freight for demo PO delivery.',
    },
    select: { id: true },
  });

  for (const item of po.items) {
    const share = itemsSubtotal > 0 ? round2((Number(item.totalPrice) / itemsSubtotal) * shippingAmount) : 0;
    await prisma.shippingCostDistribution.create({
      data: {
        tenantId,
        shippingCostId: shippingCost.id,
        itemId: item.id,
        calculatedShare: money(share),
        finalShare: money(share),
      },
    });
  }
  console.log(`  ✅ Shipping: 1 shipping cost (₱${shippingAmount}) distributed across ${po.items.length} PO item(s)`);
}

// ── 3. PurchaseOrderItemAllocation: link received PO items to stock ─────────

async function seedPurchaseOrderItemAllocations(prisma: PrismaClient, tenantId: string): Promise<void> {
  if ((await prisma.purchaseOrderItemAllocation.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  PO item allocations already seeded. Skipping.');
    return;
  }

  const po = await prisma.purchaseOrder.findFirst({
    where: { tenantId, status: 'received' },
    select: { items: { select: { id: true, quantity: true, quantityReceived: true } } },
  });
  if (!po || po.items.length === 0) {
    console.log('  ⏭  No received PO with items — skipping PO item allocations.');
    return;
  }

  const warehouse = await prisma.warehouse.findFirst({ where: { tenantId }, select: { id: true } });

  let count = 0;
  for (const item of po.items) {
    const qty = Number(item.quantityReceived) > 0 ? Number(item.quantityReceived) : Number(item.quantity);
    if (qty <= 0) continue;
    await prisma.purchaseOrderItemAllocation.create({
      data: {
        tenantId,
        itemId: item.id,
        type: 'stock',
        quantity: money(qty),
        warehouseId: warehouse?.id ?? null,
        processedAt: daysAgo(6),
      },
    });
    count++;
  }
  console.log(`  ✅ PO item allocations: ${count} allocation(s) → stock`);
}

// ── 4. ProductSerialNumber: serials for 1–2 products ─────────────────────────

async function seedProductSerialNumbers(prisma: PrismaClient, tenantId: string): Promise<void> {
  if ((await prisma.productSerialNumber.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  Product serial numbers already seeded. Skipping.');
    return;
  }

  const products = await prisma.product.findMany({ where: { tenantId }, select: { id: true }, take: 2 });
  if (products.length === 0) {
    console.log('  ⏭  No products — skipping product serial numbers.');
    return;
  }

  const warehouse = await prisma.warehouse.findFirst({ where: { tenantId }, select: { id: true } });

  const serialSpecs: readonly { status: string; sold: boolean }[] = [
    { status: 'in_stock', sold: false },
    { status: 'in_stock', sold: false },
    { status: 'sold', sold: true },
  ];

  let count = 0;
  for (let p = 0; p < products.length; p++) {
    const product = at(products, p);
    for (let s = 0; s < serialSpecs.length; s++) {
      const spec = at(serialSpecs, s);
      await prisma.productSerialNumber.create({
        data: {
          tenantId,
          productId: product.id,
          serialNumber: `SN-${num(p + 1)}-${num(s + 1, 3)}-${Date.now().toString(36).toUpperCase()}${count}`,
          status: spec.status,
          warehouseId: spec.sold ? null : (warehouse?.id ?? null),
          notes: spec.sold ? 'Sold to customer — demo showcase.' : 'In stock — demo showcase.',
        },
      });
      count++;
    }
  }
  console.log(`  ✅ Product serial numbers: ${count} serial(s) across ${products.length} product(s)`);
}

// ── 5. ProductPurchaseHistory: 2–3 historical purchases per product ─────────

async function seedProductPurchaseHistory(prisma: PrismaClient, tenantId: string): Promise<void> {
  if ((await prisma.productPurchaseHistory.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  Product purchase history already seeded. Skipping.');
    return;
  }

  const products = await prisma.product.findMany({ where: { tenantId }, select: { id: true, baseCost: true }, take: 3 });
  const vendors = await prisma.vendor.findMany({ where: { tenantId }, select: { id: true }, take: 5 });
  if (products.length === 0 || vendors.length === 0) {
    console.log('  ⏭  No products or vendors — skipping product purchase history.');
    return;
  }

  let count = 0;
  for (let p = 0; p < products.length; p++) {
    const product = at(products, p);
    const baseCost = Number(product.baseCost) > 0 ? Number(product.baseCost) : 500;
    const purchaseCount = 2 + (p % 2); // 2 or 3 rows per product
    for (let r = 0; r < purchaseCount; r++) {
      const drift = 1 + (r - 1) * 0.03; // small cost variance across purchases
      await prisma.productPurchaseHistory.create({
        data: {
          tenantId,
          productId: product.id,
          vendorId: at(vendors, p + r).id,
          unitPrice: money(round2(baseCost * drift)),
          quantity: money(20 + r * 10),
          currency: 'PHP',
          purchasedAt: dateAgo(90 - r * 30 - p * 5),
        },
      });
      count++;
    }
  }
  console.log(`  ✅ Product purchase history: ${count} row(s) across ${products.length} product(s)`);
}

// ── 6. Warehouse: 2nd branch warehouse ───────────────────────────────────────

async function seedSecondWarehouse(prisma: PrismaClient, tenantId: string): Promise<void> {
  const warehouseCount = await prisma.warehouse.count({ where: { tenantId } });
  if (warehouseCount >= 2) {
    console.log('  ⏭  2+ warehouses already present. Skipping second warehouse.');
    return;
  }

  const existing = await prisma.warehouse.findUnique({
    where: { tenantId_code: { tenantId, code: 'cebu-branch' } },
    select: { id: true },
  });
  if (existing) {
    console.log('  ⏭  Cebu Branch Warehouse already exists. Skipping.');
    return;
  }

  await prisma.warehouse.create({
    data: {
      tenantId,
      name: 'Cebu Branch Warehouse',
      code: 'cebu-branch',
      address: 'Unit 4, IT Park, Lahug, Cebu City',
      isDefault: false,
      isActive: true,
    },
  });
  console.log('  ✅ Warehouse: Cebu Branch Warehouse created');
}

// ── 7. TaskStatusReport: 1–2 status updates per active task ─────────────────

async function seedTaskStatusReports(prisma: PrismaClient, tenantId: string): Promise<void> {
  if ((await prisma.taskStatusReport.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  Task status reports already seeded. Skipping.');
    return;
  }

  const tasks = await prisma.task.findMany({
    where: { tenantId, status: { in: ['in_progress', 'todo', 'blocked', 'done'] } },
    select: {
      id: true,
      status: true,
      assignments: { select: { userId: true }, take: 1 },
    },
  });
  if (tasks.length === 0) {
    console.log('  ⏭  No tasks — skipping task status reports.');
    return;
  }

  const notesByStatus: Record<string, readonly string[]> = {
    todo: ['Not started yet — waiting on prerequisite task.'],
    in_progress: ['Work underway, on track for the due date.', 'Blocked briefly on a vendor reply, resumed today.'],
    blocked: ['Blocked — awaiting client sign-off before continuing.'],
    done: ['Completed and verified.'],
  };

  let count = 0;
  for (let i = 0; i < tasks.length; i++) {
    const task = at(tasks, i);
    const assigneeId = task.assignments[0]?.userId;
    if (assigneeId === undefined) continue;

    const notes = notesByStatus[task.status] ?? ['Status update — demo showcase.'];
    for (let n = 0; n < notes.length; n++) {
      await prisma.taskStatusReport.create({
        data: {
          tenantId,
          taskId: task.id,
          userId: assigneeId,
          status: task.status,
          note: at(notes, n),
          createdAt: daysAgo(5 - i - n),
        },
      });
      count++;
    }
  }
  console.log(`  ✅ Task status reports: ${count} report(s) across ${tasks.length} task(s)`);
}
