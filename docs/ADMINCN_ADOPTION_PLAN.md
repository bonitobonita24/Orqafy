# AdminCN Full-Site Adoption Plan — Orqafy

> **STATUS: PLAN — awaiting owner approval before ANY build.** Owner directive 2026-08-07
> (PENDING_DECISIONS.md ⭐ AdminCN). This document is the PM+Architect plan required by
> Scenario 49; it does not authorize execution. HARD HOLD throughout — LOCAL only, no
> staging/prod/demo without an explicit owner word.
>
> **Prerequisite: ✅ DONE.** Orqafy synced to framework **V32.45.1** (commit `d7c993d`) —
> `admincn-starter.md` #39, the 222-file `starter/admincn/` slice, and Scenario 49 are now
> in-repo. This plan is written against them.

Authorities: `.ai_prompt/admincn-starter.md` (#39) · `.ai_prompt/scenarios.md` Scenario 49 ·
`ui-rules.md` Rule 8 (app-shell) + Rule 12 (compiled tokens) · Rule 31 (design baseline) ·
Rule 34 (RBAC).

---

## 1. Contract (non-negotiable guardrails)

- **UI/DESIGN LAYER ONLY.** Keep Orqafy's real tRPC + Prisma + Auth.js v5. **Never** import
  AdminCN's `fake-db` / `zustand` (except client-ephemeral UI state) / `nuqs`.
- **INHERIT-not-REPLACE.** AdminCN supplies structure, shell, components, presets. Orqafy's
  token *values* win every conflict.
- **shadcn/ui stays the only component system.** AdminCN *is* shadcn/ui + studio-Pro extras.
- **Strangler-style.** One shell region / one view at a time, working at every step. Never a
  big-bang swap. verify-all-pages after each increment (no regression to any existing flow).
- **License.** AdminCN is use-in-own/client-projects only, no redistribution. The Orqafy repo
  now carries the vendored slice → **must stay private** (`starter/admincn/PROVENANCE.md`).

---

## 2. Current state (from live inventory, 2026-08-07)

- **102 `page.tsx`**, **23 authed modules** under `(tenant)/[slug]/(app)`, plus 3 surfaces:
  authed ERP shell · public storefront (`store/`, 4 pages) · platform-admin
  (`powerbyte-admin/`, 2 pages) · 6 public/auth top-level pages.
- **Shell = one entry point:** `(tenant)/[slug]/(app)/layout.tsx` + 4 components in
  `apps/web/src/components/layout/` (`app-sidebar`, `sidebar-nav`, `app-header`,
  `content-container`, `mobile-nav`).
- **Nav:** one hardcoded `NAV_ITEMS` array in `sidebar-nav.tsx`, visibility RBAC-gated at
  runtime by `trpc.role.myPermissions` per item `featureKey` (deny-by-default). Flat list.
- **Components:** 19 shadcn primitives in `apps/web/src/components/ui/` (new-york, neutral,
  cssVariables, lucide, Tailwind **v3-config**). `packages/ui` is a minimal scaffold.
- **Theme:** **dark-only**, single `:root` in `apps/web/src/app/globals.css` (153 lines).
  **No `next-themes`, no ThemeProvider, no light block, no `.dark` switching**
  (deliberate — "owner-approved reskin 2026-06-18").
- **Design baseline:** `docs/DESIGN.md` exists (238 lines). **Absent:** `docs/tokens.json`,
  `docs/MOCKUP.jsx`, `docs/design-baseline/manifest.json` — Orqafy never adopted the
  Style-Dictionary token pipeline or the `design:fidelity` gate.

## 3. Gap analysis (Orqafy → AdminCN)

| Area | Orqafy today | AdminCN baseline | Gap / work |
|---|---|---|---|
| Component set | 19 primitives | 50 (shadcn + Pro extras) | Add ~31 missing (standard shadcn: tabs, tooltip, popover, command, form, accordion, checkbox, switch, etc. + Pro extras: timeline, kanban, number-ticker, combobox, field, input-group, circular-progress, border-beam, kbd, button-group…). Never duplicate existing 19. |
| App shell | bespoke 4-component sidebar shell | `default-layout` left-sidebar shell | Adopt AdminCN shell, migrate `NAV_ITEMS`→`navConfig`, **preserve RBAC `featureKey` gating**. |
| Theme system | dark-only, no provider | `next-themes` + light/dark + 10+ presets + ThemeCustomizer | **Decision D-A** (below) — adopt light/dark or keep dark-only. |
| Tokens | `globals.css :root` HSL, Tailwind v3 | preset values → `tokens.json`/Style-Dictionary | `docs/tokens.json` absent → **Decision D-C** (fold into globals.css vs introduce pipeline). |
| Design baseline | `docs/DESIGN.md` only | Rule 31 fidelity gate | Re-baseline at end (Rule 31): update DESIGN.md, add MOCKUP.jsx, capture `design:fidelity`. |
| Data layer | real tRPC/Prisma/Auth.js | `fake-db`/zustand/nuqs (excluded) | Graft each adopted scaffold view → real tRPC (5 states + RBAC). |

---

## 4. Phased plan (strangler-style, dev-first, HARD HOLD)

**Phase A — Foundation (no visible change) — effort S–M, ~1–2 sessions**
1. Reconcile component set: diff `apps/web/src/components/ui/` vs `starter/admincn/components/ui/`;
   add only the missing AdminCN components. Keep new-york/neutral/lucide.
2. Theme infrastructure (per **Decision D-A**): if adopting light/dark, add `ThemeProvider` +
   `next-themes` to `apps/web/src/app/layout.tsx`, add ThemeCustomizer + ModeToggle, add a light
   token block. If keeping dark-only, skip provider; still adopt AdminCN's token *structure*.
3. Theme values (per **Decision D-C**): pick ONE AdminCN preset (**Decision D-B**), fold its
   accent/radius/surface VALUES into the token source. Orqafy tokens win on value conflicts.
   Gate: build + typecheck green; app visually unchanged.

**Phase B — App-shell adoption — effort M, ~1–2 sessions**
- Swap `components/layout/*` to the AdminCN `default-layout` shell behind existing routes
  (`(tenant)/[slug]/(app)/layout.tsx` is the single mount point). Migrate `NAV_ITEMS`→`navConfig`
  **carrying every `featureKey`** so RBAC gating + deny-by-default + loading Skeleton are preserved.
  Keep mobile off-canvas nav. verify-all-pages: every module still reachable + RBAC-filtered.

**Phase C — View grafts, module-by-module — effort L, ~6–10 sessions (grouped)**
For each screen reskinned to an AdminCN scaffold, run the #39 `fake-db`→tRPC graft (map mock
shape → existing Prisma model + tRPC router, reuse `packages/shared` Zod; wire loading/empty/
error/partial/success; enforce tenant-scope + `hasPermission`). Recommended group order:
- **C1 Dashboard + Reports** — highest visual payoff; AdminCN dashboard/charts/statistics/widgets scaffolds map directly.
- **C2 Settings + RBAC** (settings, users, roles, departments, expense-categories, smtp, xendit, breach) — AdminCN `views/apps/{permissions,roles,users}` are the RBAC UI baseline (Rule 34).
- **C3 Sales** — crm (customers, contact-logs, quotations+pdf), clients, invoices.
- **C4 Supply/Retail** — purchasing (orders, receipts, vendors), inventory (products, categories, warehouses, stock-movements), pos, ecommerce/orders.
- **C5 Finance** — banking (fund-sources, transactions), accounting (accounts, journal-entries, fiscal-years, trial-balance), payroll (runs, payslips, statutory-rates), expenses.
- **C6 Ops/HR** — projects (+expenses), tasks, job-orders, service, employees, dtr, support.

**Phase D — Secondary surfaces — effort M, ~2 sessions** (per **Decision D-D**)
- Storefront (`store/`, public, cart-based) and platform-admin (`powerbyte-admin/`, Platform-Owner)
  each get their own design pass (distinct from the ERP shell).

**Phase E — Re-baseline + final gate — effort S, ~1 session**
- Rule 31: update `docs/DESIGN.md` + create `docs/MOCKUP.jsx` to the AdminCN direction; capture a
  fresh `design:fidelity` baseline; log in `docs/DECISIONS_LOG.md`.
- Full gate: build, typecheck, tests, `lint-design.sh` on authored screens (vendored-slice tells
  are out of scope), verify-all-pages across all 3 surfaces. Back-port CHANGELOG_AI.md (Rule 15).
  Commit LOCAL only.

**Total estimate: ~12–18 dev sessions, effort M–L** — matches the directive's "M–L, multi-session."
Each phase/group = its own `feat/admincn-<area>` branch, committed LOCAL when verified.

---

## 5. Open decisions for the owner ([WHAT] unless noted)

- **D-A — Theme mode.** Adopt AdminCN light/dark + ThemeCustomizer, or keep Orqafy's deliberate
  dark-only? *Recommend:* adopt light/dark (AdminCN's strength) but **default to dark** to
  preserve current feel. Reversible.
- **D-B — Default preset.** Which of AdminCN's 10+ presets is Orqafy's default accent/radius/surface?
  *Recommend:* pick the closest to the current neutral-dark, then tune.
- **D-C — Token architecture ([HOW], owner may weigh in).** Fold preset values into the existing
  `globals.css :root` (matches current Tailwind-v3 arch, minimal), **or** introduce the full
  `docs/tokens.json` → Style-Dictionary pipeline (Scenario 49's assumption; bigger, aligns with
  Rule 12/31). *Recommend:* fold-into-globals.css now; defer the pipeline.
- **D-D — Scope.** All 3 surfaces (ERP + storefront + platform-admin), or ERP-only first? *Recommend:*
  ERP shell first (Phases A–C), storefront + platform-admin as a follow-on (Phase D).
- **D-E — Priority vs competing work.** AdminCN competes with prior queued work (Phase-7 buildout
  Epics 3–5 / D-1..D-4, RBAC 3-tier retrofit, tenant_id migration-drift, Customer Portal D-1).
  Confirm ordering before dispatch.

## 6. Notes

- **HARD HOLD.** Every phase commits LOCAL only. No staging/prod/demo, no push, without an explicit
  owner word (`deploy-discipline.md`).
- **License.** Repo carries the AdminCN paid slice → keep private, no redistribution.
- **Blast radius.** The shell reskin (Phase B) touches every authed page via one layout; treat as a
  wide-blast change — verify-all-pages is mandatory after B and after each C group.
