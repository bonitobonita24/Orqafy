/**
 * Backfill: populate publicToken for Invoice rows that have NULL public_token.
 *
 * Idempotent — skips rows that already have a token.
 * Run against DEV only:
 *   pnpm --filter @orqafy/db exec ts-node scripts/backfill-invoice-public-token.ts
 *
 * Staging/prod: run `prisma migrate deploy` at deploy time (no data migration
 * needed there — @default on the column handles new rows; existing null rows in
 * staging/prod must also be backfilled by running this script against those
 * envs with the appropriate DATABASE_URL exported first).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const nullRows = await prisma.invoice.findMany({
    where: { publicToken: null },
    select: { id: true },
  });

  if (nullRows.length === 0) {
    console.log("No invoices with null publicToken — nothing to do.");
    return;
  }

  console.log(`Backfilling ${nullRows.length} invoice(s)…`);

  let updated = 0;
  for (const row of nullRows) {
    await prisma.invoice.update({
      where: { id: row.id },
      data: { publicToken: crypto.randomUUID() },
    });
    updated++;
  }

  console.log(`Done. Updated ${updated} invoice(s) with unique publicToken values.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
