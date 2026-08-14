# Changelog

All notable changes per release. A version is assigned at each push/merge to `main`;
entries are auto-derived from Conventional-Commit types. See
`~/.claude/rules/release-changelog-discipline.md`.

## v0.15.0 — 2026-08-14

### [FEATURE]
- capture design-fidelity baselines (landing+login) + playwright devDep (`5c20b21`)
- arm design-fidelity gate — data-fdl anchors + baseline manifest (Phase 7) (`f51ab38`)
- landing page on studio hero/features/cta blocks (Phase 5) (`800895c`)
- auth pages on studio login/register blocks (Phase 5) (`a41cf52`)
- install shadcn/studio blocks for Phase 5 (hero, features, cta, login, register, stats) (`1b2a3ed`)
- install shadcn/studio blocks for Phase 5 (hero, features, cta, login, register, stats) (`427244e`)

### [FIXED]
- tighten landing hero vertical rhythm after image drop (`372c0de`)
- unwrap hsl(var(--token)) — theme tokens are oklch since Tailwind v4 (`5a353be`)

### [DOCS]
- save session 2026-08-14 pm — THEME Phase 5-7 done+verified, fidelity gate armed (`d4baa1a`)
- record Phase 5-7 scope calls + fidelity-gate arming (`7a6a6de`)
- reconcile DESIGN.md to released orqafy theme + studio blocks (Phase 7) (`ba72a30`)
- save session 2026-08-14 — v0.14.0 released, decision queue cleared, chart-token fix on main (`8d931de`)

### [CHORE]
- Phase 5 cleanup — remove demo routes + unused block sources, drop lucide-react again (`776a643`)


## v0.14.0 — 2026-08-14

### [FEATURE]
- multi-hue categorical chart palette (chart-1..5, light+dark) (`f5c5885`)
- migrate lucide-react → hugeicons via icon adapter (Phase 4) (`052152d`)
- adopt shadcn/studio orqafy theme + fonts (Phase 2+3) (`742670b`)
- migrate apps/web from Tailwind v3.4 to v4 (Phase 1 — plumbing) (`69dbcc7`)

### [FIXED]
- use exact hugeicons glyphs for calendar/book icons (`517b222`)
- poll prod health until 200 in push-to-prod verify step (`2bbdba3`)
- make ensure-dev-fresh worker rebuild a valid compose project (`fc1a777`)

### [DOCS]
- record owner ratification of full 2026-08-14 decision queue (`1759178`)
- save session — Phase 4 lucide→hugeicons DONE + verified (`23ce3e7`)
- save session 2026-08-13 — theme Phases 0-3 done + v0.13.3 queue + handoff (`99155b9`)
- mark Phases 0-3 done + record QA review flags (`8073b0f`)
- plan of record — Tailwind v4 migration + shadcn/studio orqafy theme adoption (`5893e7b`)


## v0.13.2 — 2026-08-12

### [FIXED]
- point deploy tooling at orqafy.com hosts after domain migration (`26eaafe`)


## v0.13.1 — 2026-08-11

### [FIXED]
- correct dead-name gates — Admin regains DTR approval + employee termination (`00db013`)


## v0.13.0 — 2026-08-11

### [FEATURE]
- couple dev-rebuild to every ship (Rule 39 dev-freshness) (`298fec4`)


## v0.12.3 — 2026-08-09

### [FIXED]
- make seed prod-safe — gate demo showcase off in production, parameterize tenant + super admin (`b8bc912`)

### [DOCS]
- flag Item#1 (seed-fix merge/release) as owner-authorized next-session resume point (`2aa2277`)
- PROD first stand-up complete — https://orqafy.com LIVE + verified (`9459343`)
- Wave 0 ship done (v0.12.2, staging+demo LIVE on orqafy.com); PROD resume checklist (`20d20f8`)


## v0.12.2 — 2026-08-08

### [FIXED]
- patch critical/high advisories (Auth.js fail-open, next, toolchain) (`9af4f52`)


## v0.12.1 — 2026-08-08

### [FIXED]
- pin pnpm to 10.11.0 in web+worker images (`d7fc629`)

### [DOCS]
- 2026-08-08 build program + gitignore paid _tempfiles (`d95569f`)


## v0.12.0 — 2026-08-08

### [FEATURE]
- Phase D — platform-admin console idiom polish (data + auth gate preserved) (`7e0be78`)
- Phase C6 — DTR + support idiom polish (data preserved) (`37a1f48`)
- Phase C6 — employees idiom polish (data preserved) (`f353567`)
- Phase C6 — job-orders + service idiom polish (data preserved) (`edd38de`)
- Phase C6 — projects idiom polish (data preserved) (`6ab7e4d`)
- Phase C5/C6 — expenses + tasks idiom polish (data preserved) (`6a5c576`)
- Phase C5 — payroll idiom polish (data + math preserved) (`cd5b171`)
- Phase C5 — accounting fiscal-years/trial-balance/settings idiom polish (data + math preserved) (`6b65cbc`)
- Phase C5 — accounting journal-entries idiom polish (data + math preserved) (`4d9052e`)
- Phase C5 — accounting idiom polish (data + math preserved) (`741e875`)
- Phase C5 — banking idiom polish (data + math preserved) (`6b2c963`)
- Phase C4 — POS + ecommerce idiom polish (immersive new-sale preserved, data preserved) (`c9cae33`)
- Phase C4 — inventory idiom polish (data preserved) (`5ed9bf0`)
- Phase C4 — purchasing receipts + vendors idiom polish (data preserved) (`cc03834`)
- Phase C4 — purchasing orders idiom polish (data preserved) (`c917261`)
- Phase C3 — CRM contact-logs idiom polish (data preserved) (`22f18e9`)
- Phase C3 — CRM quotations idiom polish (pdf layout untouched, data preserved) (`9fda2bd`)
- Phase C3 — clients idiom polish (data preserved) (`9c738a3`)
- Phase C3 — CRM customers idiom polish (data preserved) (`33441c8`)
- Phase C3 — invoices idiom polish + reusable PageHeader (data preserved) (`54c93f8`)
- Phase C2 — settings roles/users view graft (RBAC logic preserved, UI-only) (`37f4b33`)
- Phase C1 — dashboard view graft (AdminCN statistic cards, data preserved) (`5c6326a`)
- Phase B — app-shell swap to shadcn sidebar primitive (RBAC nav gating preserved) (`0f56bd7`)
- Phase A2 — theme infrastructure (next-themes light/dark, default dark, dark values preserved) (`5a071d6`)
- Phase A1 — reconcile component set (add missing AdminCN/shadcn components) (`a7e22c6`)
- adaptive SEO foundation — indexable public routes, noindex authed (Scenario 44) (`cd7d655`)
- down-sync — pull tasks + payslips server→phone (dev-first) (`aa7edfd`)
- wire sync client to server endpoints — real payloads, serverId write-back, category picker, receipt upload (`bcb69a4`)
- expense receipt upload leg (POST /api/sync/expenses/[serverId]/receipt via shared performDirectUpload) (`3bea3bf`)
- implement dtr/tasks/expenses sync handlers + expense-categories picker endpoint (`3107c2b`)
- mobile-sync route + MobileSyncOp idempotency ledger (wired to real MOBILE_JWT_SECRET bearer auth) (`f552505`)
- camera receipt capture + expo-image-manipulator compression in expenses (`baac37d`)
- Expo push fan-out to device tokens on notification create (`533cf71`)
- mobile-web app-download soft interstitial (dismissible, 30d TTL) (`a13e811`)
- image thumbnails (variant MediaObject + Attachment.thumbnailKey) + list rendering (`9b50f7c`)
- wire client to mobile-auth endpoints + tRPC bearer + shadcn token resync (`7858c7b`)
- compress images client-side + route uploads through Telegram-aware uploadDirect (`b95b7b8`)
- accept mobile Bearer JWT in context (alongside NextAuth cookie) (`63ac2b3`)
- mobile JWT auth endpoints (login/refresh/logout) + DevicePushToken + push-token route (`18b4389`)
- add client-side image-compression helper (browser-image-compression) (`3417e0a`)

### [FIXED]
- allow /robots.txt, /sitemap.xml, /privacy through auth middleware (`775e6ce`)
- dashboard C1 — drop renderLabel fn prop (RSC boundary error) (`14f382a`)
- gate ops with web-parity matrix verbs (DTR clock-out=dtr:create not dtr:update) + reject unsupported entity/action combos (`0480cfe`)
- hoist image-compression mock (vi.hoisted — fixes no-unsafe-return lint + vi.mock hoisting) (`6427acd`)

### [DOCS]
- SESSION 2026-08-08 — AdminCN+SEO verified/ratified, SEO middleware bug fixed (main d70dabd, 71 ahead, HARD HOLD) (`b34b2a5`)
- record owner ratification of AdminCN + SEO (post-hoc) (`d70dabd`)
- AdminCN + SEO merged to local main (8cfa127), unpushed/HARD HOLD (`adf57d3`)
- AdminCN adoption autonomously complete + verified; owner items pending (`fe7fdc2`)
- record AdminCN design adoption (foundation+shell+authed surfaces) (`e761e4c`)
- C1 fixed + C2 verified; C3-E paused for owner scope calibration (`ddc393c`)
- AdminCN progress — SEO + Phase A/B done+verified, C/D/E remain (`37e1584`)
- overnight autonomous addendum — SEO surfaced as D-SEO, paced hold (`348ff25`)
- 2026-08-07 full-auto — framework sync V32.45.1 + AdminCN plan (`769fb16`)
- AdminCN full-site adoption plan (Scenario 49, awaiting approval) (`02cd37e`)
- session-end handoff + STATE — down-sync done, merged local main aa7edfd (`8e1a836`)
- mobile down-sync implementation plan — 7 tasks, TDD (`e578607`)
- mobile down-sync design — tasks + payslips server→phone pull (`aec34e0`)
- full session-end handoff + STATE — gated queue (push→staging/prod/RBAC) + open items (task pull-sync); local main unpushed (`2cc9e0d`)
- 2-feature program complete dev-first (uploads compression+Telegram+thumbnails; mobile auth→push→interstitial→camera→EAS) — local main, unpushed (`008783f`)
- gated-queue staging tier shipped — main green+pushed d3ad765, staging on sha-6776198, v0.11.0-rc.1, compose model-a locked, RBAC dev-local; prod held (`52e6a6b`)
- reconcile repo compose to live layout (model a mirror) + lock deploy-model decision + resolve reconciliation doc (`d3ad765`)

### [CHORE]
- sync V32.31 -> V32.45.1 + complete V32.7 relocation (`d7c993d`)
- reconcile in-progress sync to V32.31 (SEO Foundation baseline) (`80010c0`)
- EAS submit skeletons + fleet version align (0.x) — eas init pending owner Expo login (`d8bc6fb`)

