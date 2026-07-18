/**
 * demo-seed-utils.ts
 *
 * Shared helpers for the demo showcase seed modules (demo-showcase.ts and the
 * per-domain demo-*.ts enrichment files). Extracted so each domain seed file
 * can import the same money/date/pick helpers instead of redefining them.
 *
 * TypeScript strict: no `any`. Decimal money/quantity fields must be passed as
 * fixed(2) plain STRINGS (Prisma accepts strings for Decimal columns — avoids
 * JS float drift). Use money()/round2() for that.
 */

/** A timestamp n days ago at 09:00 (n<0 ⇒ future). */
export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** A date-only value (00:00) for @db.Date columns, n days ago (n<0 ⇒ future). */
export function dateAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** A timestamp offset days from now at 09:00 (+future / -past). */
export function offsetDate(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Fixed-2 money string (no float drift). */
export function money(n: number): string {
  return n.toFixed(2);
}

/** Round to 2 decimals (numeric). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Non-null indexed pick that satisfies noUncheckedIndexedAccess (cycles). */
export function at<T>(arr: readonly T[], i: number): T {
  const v = arr[((i % arr.length) + arr.length) % arr.length];
  if (v === undefined) {
    throw new Error('demo-seed-utils: unexpected empty pool during pick');
  }
  return v;
}

/** Zero-padded numeric string (default width 4): num(1) => "0001". */
export function num(i: number, width = 4): string {
  return String(i).padStart(width, '0');
}
