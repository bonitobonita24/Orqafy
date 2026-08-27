// Shared portal status groupings — single source of truth so the portal
// dashboard tiles (portal/(portal-app)/page.tsx) and the dashboard.summary
// tRPC procedure (routers/portal.ts) always agree on what "active"/"open" means.

/** EcommerceOrder statuses considered still in-flight (not delivered/cancelled). */
export const ACTIVE_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
] as const;

/** JobOrder (repair) statuses considered open (not yet released/cancelled). */
export const OPEN_REPAIR_STATUSES = [
  "received",
  "diagnosing",
  "quoted",
  "approved",
  "in_progress",
  "testing",
  "completed",
] as const;
