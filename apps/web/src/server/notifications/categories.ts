/**
 * D7 — canonical in-app notification categories.
 *
 * `Notification.category` is a plain String column (matching the repo's
 * String-status convention, e.g. CONTACT_LOG_TYPES). This is the single
 * source of truth for the allowed set. Add a new category by appending here;
 * do NOT remove an existing one without a data migration to remap rows.
 */
export const NOTIFICATION_CATEGORIES = [
  "order_placed", // a new ecommerce order was placed
  "task_assigned", // a task was assigned to the recipient
  "invoice_payment", // a payment was recorded against an invoice
  "system", // generic / fallback
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export function isNotificationCategory(v: string): v is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(v);
}
