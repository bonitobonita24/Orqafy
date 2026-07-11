import { z } from "zod";

/**
 * RBAC feature registry — the fleet-wide typed enum of every gateable surface
 * in the app (tenant-rbac-standard.md §4 "feature registry").
 *
 * Enum-over-table (locked decision): features are code-coupled — each key
 * maps to a router and/or a sidebar nav item that ships together in a
 * release. A DB-driven `feature_registry` table would allow orphaned keys
 * with zero enforcement code behind them (a row with no matching router).
 * The typed enum gives compile-time exhaustiveness instead: adding a feature
 * means adding it here AND wiring the matching router/nav entry, or
 * TypeScript (and the accompanying test) will not compile/pass.
 *
 * 'users' and 'billing' are the two guardrail-forbidden features per the
 * tenant-rbac-standard (§4 guardrails): custom roles may NEVER be granted
 * either — those stay exclusive to tenant_superadmin (+ platform
 * tenant_manager). They are still enumerated here because the matrix /
 * role-builder UI must list every feature to correctly grey them out.
 *
 * 'settings' covers the admin-config surface (smtp-config, admin-xendit-config,
 * department, expense-category routers) as ONE key per ruling Q-FR1 — those
 * routers are all reached from the single /settings nav destination.
 */
export const FEATURE_KEYS = [
  "dashboard",
  "crm",
  "invoices",
  "purchasing",
  "inventory",
  "projects",
  "tasks",
  "employees",
  "dtr",
  "payroll",
  "expenses",
  "banking",
  "accounting",
  "pos",
  "storefront",
  "support",
  "job_orders",
  "reports",
  "compliance",
  "dsr",
  "settings",
  "users",
  "billing",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const featureKeySchema = z.enum(FEATURE_KEYS);
