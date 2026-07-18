/**
 * demo-banking-extras.ts
 *
 * Enriches the DEMO tenant's Banking module beyond the basic FundSource +
 * FundTransaction ledger seeded by demo-showcase.ts's seedBanking(). The
 * banking router also exposes transfer / credit-card / fund-request flows
 * whose backing models (FundTransfer, CreditCardTransaction,
 * CreditCardPayment, FundRequest) are otherwise never populated — this file
 * gives those sub-flows real rows to demo against.
 *
 * Standalone, additive module: does NOT touch demo-showcase.ts. Run it after
 * seedDemoShowcase() has already created the tenant's FundSources + a user.
 *
 * TypeScript strict: no `any`. Decimal fields passed as money() strings.
 */

import type { PrismaClient } from '@prisma/client';
import { money, daysAgo, at, round2 } from './demo-seed-utils';

export async function seedBankingExtras(prisma: PrismaClient, tenantId: string): Promise<void> {
  // Idempotency guard — FundTransfer is the primary new model this seeds.
  if ((await prisma.fundTransfer.count({ where: { tenantId } })) > 0) {
    console.log('  ⏭  Banking extras already seeded. Skipping.');
    return;
  }

  const fundSources = await prisma.fundSource.findMany({
    where: { tenantId },
    select: { id: true, name: true, type: true, currentBalance: true },
    orderBy: { createdAt: 'asc' },
  });
  if (fundSources.length === 0) {
    console.log('  ⏭  Banking extras: no FundSources found for tenant — run seedDemoShowcase() first. Skipping.');
    return;
  }

  const user = await prisma.user.findFirst({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) {
    console.log('  ⏭  Banking extras: no User found for tenant. Skipping.');
    return;
  }
  const userId = user.id;

  let transfersSeeded = 0;
  let creditCardTxnsSeeded = 0;
  let creditCardPaymentsSeeded = 0;
  let fundRequestsSeeded = 0;

  // ── 1. FundTransfer between two existing fund sources ─────────────────────
  // FundTransfer links two FundTransaction rows (transfer_out / transfer_in),
  // not the FundSource ids directly — mirror that pairing.
  if (fundSources.length >= 2) {
    const fromSource = at(fundSources, 0);
    const toSource = at(fundSources, 1);
    const transferAmount = 50000;

    const outTxn = await prisma.fundTransaction.create({
      data: {
        tenantId,
        fundSourceId: fromSource.id,
        type: 'transfer_out',
        amount: money(transferAmount),
        runningBalance: money(round2(Number(fromSource.currentBalance) - transferAmount)),
        category: 'transfer',
        description: `Fund transfer to ${toSource.name}`,
        createdById: userId,
        transactionDate: daysAgo(6),
      },
    });
    const inTxn = await prisma.fundTransaction.create({
      data: {
        tenantId,
        fundSourceId: toSource.id,
        type: 'transfer_in',
        amount: money(transferAmount),
        runningBalance: money(round2(Number(toSource.currentBalance) + transferAmount)),
        category: 'transfer',
        description: `Fund transfer from ${fromSource.name}`,
        createdById: userId,
        transactionDate: daysAgo(6),
      },
    });
    await prisma.fundTransfer.create({
      data: {
        tenantId,
        fromTransactionId: outTxn.id,
        toTransactionId: inTxn.id,
        amount: money(transferAmount),
        description: `Rebalance: ${fromSource.name} → ${toSource.name}`,
        createdById: userId,
        createdAt: daysAgo(6),
      },
    });
    // Reflect the transfer in the source FundSource balances so figures stay consistent.
    await prisma.fundSource.update({
      where: { id: fromSource.id },
      data: { currentBalance: money(round2(Number(fromSource.currentBalance) - transferAmount)) },
    });
    await prisma.fundSource.update({
      where: { id: toSource.id },
      data: { currentBalance: money(round2(Number(toSource.currentBalance) + transferAmount)) },
    });
    transfersSeeded = 1;
  } else {
    console.log('  ⏭  Banking extras: fewer than 2 FundSources — skipping FundTransfer.');
  }

  // ── 2. Credit-card fund source + transactions + a payment ─────────────────
  // FundSource.type comment declares 'credit_card' as a valid discriminant.
  let creditCardSourceId = fundSources.find((s) => s.type === 'credit_card')?.id ?? null;
  if (creditCardSourceId === null) {
    const creditLimit = 200000;
    const ccSource = await prisma.fundSource.create({
      data: {
        tenantId,
        name: 'BDO Business Platinum',
        type: 'credit_card',
        bankName: 'BDO',
        accountNumber: '4521-XXXX-XXXX-9081',
        currentBalance: money(0),
        creditLimit: money(creditLimit),
        outstandingBalance: money(0),
        statementDueDay: 15,
        currency: 'PHP',
        isActive: true,
      },
    });
    creditCardSourceId = ccSource.id;
  }

  if (creditCardSourceId) {
    const charges = [
      { desc: 'Office supplies — National Bookstore', amount: 4850, fee: 0, daysBack: 14 },
      { desc: 'Fuel — Shell fleet card top-up', amount: 12300, fee: 0, daysBack: 9 },
      { desc: 'Software subscription — annual renewal', amount: 18750, fee: 250, daysBack: 4 },
    ];
    let outstanding = 0;
    for (const c of charges) {
      const total = round2(c.amount + c.fee);
      outstanding = round2(outstanding + total);
      await prisma.creditCardTransaction.create({
        data: {
          tenantId,
          fundSourceId: creditCardSourceId,
          description: c.desc,
          amount: money(c.amount),
          bankFee: money(c.fee),
          totalAmount: money(total),
          transactionDate: daysAgo(c.daysBack),
          isPaid: false,
          referenceType: 'manual',
        },
      });
      creditCardTxnsSeeded++;
    }

    // Pay off the first two charges (selective payment) from the primary cash/bank source.
    const payFromSource = fundSources.find((s) => s.type !== 'credit_card') ?? at(fundSources, 0);
    const paymentAmount = round2(charges[0]!.amount + charges[1]!.amount + charges[1]!.fee);
    const paidTxns = await prisma.creditCardTransaction.findMany({
      where: { tenantId, fundSourceId: creditCardSourceId },
      select: { id: true },
      take: 2,
      orderBy: { createdAt: 'asc' },
    });
    await prisma.creditCardPayment.create({
      data: {
        tenantId,
        creditCardFundSourceId: creditCardSourceId,
        paymentType: 'selective',
        amount: money(paymentAmount),
        transactionIds: paidTxns.map((t) => t.id),
        paidFromFundSourceId: payFromSource.id,
        paidAt: daysAgo(2),
        notes: 'Selective payment — cleared oldest 2 charges before statement due date.',
      },
    });
    await prisma.creditCardTransaction.updateMany({
      where: { id: { in: paidTxns.map((t) => t.id) } },
      data: { isPaid: true, paidAt: daysAgo(2) },
    });
    creditCardPaymentsSeeded = 1;

    const remainingOutstanding = round2(outstanding - paymentAmount);
    await prisma.fundSource.update({
      where: { id: creditCardSourceId },
      data: { outstandingBalance: money(remainingOutstanding) },
    });
  }

  // ── 3. FundRequest — one pending, one approved ─────────────────────────────
  // requestNumber is globally @unique (not tenant-scoped) — suffix with the
  // tenantId to avoid collisions if this seed ever runs against >1 tenant.
  const tenantSuffix = tenantId.slice(-6).toUpperCase();
  const requests = [
    {
      requestNumber: `FR-DEMO-${tenantSuffix}-0001`,
      amount: 35000,
      purpose: 'Petty cash replenishment for repair shop consumables',
      status: 'pending',
      daysBack: 2,
    },
    {
      requestNumber: `FR-DEMO-${tenantSuffix}-0002`,
      amount: 80000,
      purpose: 'Advance for supplier down-payment — Q3 restock',
      status: 'approved',
      daysBack: 7,
    },
  ];
  for (const r of requests) {
    await prisma.fundRequest.create({
      data: {
        tenantId,
        requestNumber: r.requestNumber,
        createdById: userId,
        approvedById: r.status === 'approved' ? userId : null,
        amount: money(r.amount),
        currency: 'PHP',
        purpose: r.purpose,
        status: r.status,
        approvedAt: r.status === 'approved' ? daysAgo(r.daysBack - 1) : null,
        createdAt: daysAgo(r.daysBack),
      },
    });
    fundRequestsSeeded++;
  }

  console.log(
    `  ✅ Banking extras: ${transfersSeeded} fund transfer, ${creditCardTxnsSeeded} credit card charges, ` +
      `${creditCardPaymentsSeeded} credit card payment, ${fundRequestsSeeded} fund requests`,
  );
}
