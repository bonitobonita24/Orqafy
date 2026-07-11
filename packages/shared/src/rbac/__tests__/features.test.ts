import { describe, expect, it } from "vitest";
import { FEATURE_KEYS, featureKeySchema, type FeatureKey } from "../features";

// Mirrors apps/web/src/components/layout/sidebar-nav.tsx NAV_ITEMS hrefs
// (first path segment) so this test fails if the sidebar gains a nav
// destination that has no matching FeatureKey. Where the nav href segment
// differs from the feature key name (e.g. the "Ecommerce" nav item maps to
// the "storefront" feature/router, "job-orders" maps to "job_orders"), the
// mapping is explicit below rather than assumed equal.
const NAV_HREF_TO_FEATURE_KEY: Record<string, FeatureKey> = {
  dashboard: "dashboard",
  crm: "crm",
  invoices: "invoices",
  purchasing: "purchasing",
  inventory: "inventory",
  projects: "projects",
  tasks: "tasks",
  employees: "employees",
  dtr: "dtr",
  payroll: "payroll",
  expenses: "expenses",
  banking: "banking",
  accounting: "accounting",
  reports: "reports",
  ecommerce: "storefront",
  pos: "pos",
  support: "support",
  "job-orders": "job_orders",
  settings: "settings",
};

describe("FEATURE_KEYS", () => {
  it("has no duplicate keys", () => {
    const unique = new Set(FEATURE_KEYS);
    expect(unique.size).toBe(FEATURE_KEYS.length);
  });

  it("covers every sidebar NAV_ITEMS href segment", () => {
    for (const [navHrefSegment, featureKey] of Object.entries(
      NAV_HREF_TO_FEATURE_KEY,
    )) {
      expect(
        FEATURE_KEYS,
        `nav href "${navHrefSegment}" maps to unknown feature key "${featureKey}"`,
      ).toContain(featureKey);
    }
  });

  it("includes the guardrail-forbidden 'users' and 'billing' keys", () => {
    expect(FEATURE_KEYS).toContain("users");
    expect(FEATURE_KEYS).toContain("billing");
  });

  it("validates known keys and rejects unknown ones via featureKeySchema", () => {
    expect(featureKeySchema.safeParse("dashboard").success).toBe(true);
    expect(featureKeySchema.safeParse("not-a-real-feature").success).toBe(
      false,
    );
  });
});
