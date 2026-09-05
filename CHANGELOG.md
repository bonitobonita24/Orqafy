# Changelog

All notable changes per release. A version is assigned at each push/merge to `main`;
entries are auto-derived from Conventional-Commit types. See
`~/.claude/rules/release-changelog-discipline.md`.

## v0.20.0 — 2026-09-05

### [FEATURE]
- make coupled rollback's paired-dump pairing real (ORQ-24) (`480f327`)
- retarget demo/staging deploy scripts to EC2-Komodo (ORQ-25) (`44eb63b`)
- adopt fleet CI/CD standard — backfill rollback + demo self-heal + stack audit (ORQ-23) (`c9b2147`)

### [FIXED]
- bounded health poll in push-to-demo.sh (ORQ-22) (`ef2b6f8`)

### [DOCS]
- handoff — merge landed, all decisions resolved, no un-gated work (`705fc5a`)
- record owner resolutions — defer D-GOVSYNC, leave ORQ-27(a) degraded, hold ORQ-27(b), hold push (`417c344`)
- FF-merge ORQ-23/24/25 → local main; record merge + gated remainder (`9bfaa61`)
- session 2026-09-05 — ORQ-25 + ORQ-24 done, gov-sync plan; save session (`710a798`)
- log D-GOVSYNC plan (V32.45.1→V32.54.0, whitelist-lag blocker) (`69a5a24`)
- ORQ-24 done (coupled-rollback pairing via DEPLOYED_APP_SHA) (`5a8d71c`)
- ORQ-25 done (EC2 retarget) + demo-cron code; log ORQ-26 residuals (`32778fc`)
- park session — queue ORQ-25 EC2 retarget + ORQ-24 + demo cron + #2; loop stop (`c086fe9`)
- session handoff — CI/CD standard adopted (ORQ-23); sync-context (`fc0d18f`)
- log ORQ-23 adoption + ORQ-24 rollback-pairing follow-up; session log (`980358a`)
- ORQ-22 done + handoff; session stop (save session) (`d885860`)
- close ORQ-22 (push-to-demo health poll hardened) (`edd2476`)
- Full Auto — promoted v0.19.0 to prod + demo; handoff (save session) (`45cd062`)
- push batch + release v0.19.0 (D-SEO feature); handoff (save session) (`55f5ac9`)

### [CHORE]
- sync-context regenerate CLAUDE.md managed region (`fcd6025`)


## v0.19.0 — 2026-09-02

### [FEATURE]
- enumerate demo/flagship storefront into sitemap (D-SEO) (`e28e816`)

### [DOCS]
- merge D-SEO/RBAC branch to main; handoff (save session) (`8ff29fa`)
- close D-SEO (demo-store sitemap) + RBAC naming keep-ratified (`45b0948`)
- ORQ-19 Turnstile shipped to prod (v0.18.3) — real bot protection live + verified (`c6de318`)


## v0.18.3 — 2026-08-31

### [FIXED]
- remove hardcoded Turnstile test-key fallback in checkout (ORQ-19) (`77a32dd`)

### [DOCS]
- v0.18.2 released + ORQ-19 Turnstile code/config done; handoff + log (loop stop) (`fe64ad3`)
- ORQ-18 v0.18.2 released; ORQ-19 Turnstile code+config done (deploy gated) (`9fd1d43`)


## v0.18.2 — 2026-08-31

### [FIXED]
- add app icon.svg to stop favicon 404 on first load (ORQ-10) (`31eefdf`)
- regenerate stale prod MERGED compose — restore MinIO + Telegram storage env (ORQ-13) (`2bbce18`)

### [DOCS]
- ORQ-13 + ORQ-10 done; handoff + log + state; loop stopped (`7e6631a`)
- ORQ-10 + ORQ-13 done — favicon icon + prod MERGED regen (`46a1644`)
- release v0.18.1 (ORQ-17 tunnel + ORQ-11 limits) pushed; next=ORQ-13/ORQ-10 (`77546be`)


## v0.18.1 — 2026-08-31

### [FIXED]
- **Deploy — outage hardening (ORQ-11):** compose `mem_limit`/`memswap_limit`/`mem_reservation`/`cpus` on all
  prod/staging/demo services (dev exempt), preventing the OOM that caused the ~4-day outage (`3ac1210`).
- **Deploy — migration-tunnel safety (ORQ-17):** `push-to-prod.sh`/`push-to-demo.sh` now open the prisma-migrate
  SSH tunnel on a dedicated local port decoupled from `DB_PORT`, with a fatal-bind guard (`ExitOnForwardFailure`
  + liveness check), so a local port collision can no longer silently migrate the wrong database and report false
  success (`347e900`).

## v0.18.0 — 2026-08-28

### [FEATURE]
- W3b — Invoices/Orders/Repairs section pages + real dashboard (`f600216`)
- W3a — customer-scoped portal data router (invoices/orders/repairs/dashboard) (`5865e7d`)
- W2 — portal shell + auth UI + staff invite control (`2d3b93b`)
- W1-T1.4/T1.5 — route isolation + invite/accept/reset router (`0d9c929`)
- W1 keystone — portal auth provider + principalType + portalProcedure (`90a2541`)
- W1-T1.1 CustomerPortalInvite + customerSecurityVersion schema/migration (`d170f43`)

### [FIXED]
- give seeded customer invoices a publicToken (`6fb4e28`)

### [DOCS]
- D-1 MVP complete — milestone save (plan + session log) (`e9813fc`)
- W2 done — milestone save (plan + session log) (`20a051a`)
- W1 done — mark progress + log setPassword TOCTOU follow-up (`ecf84ec`)
- D-1 Customer Portal MVP architecture + wave plan (`2f0506c`)
- D-4 built+released v0.17.0; Full-Auto A/C done; D-1 started (`00acf04`)
- close D-4 + demo-token items (`a1bfa06`)


## v0.17.0 — 2026-08-27

### [FEATURE]
- D-4 public invoice view page + Copy-share-link (`353aeba`)
- add data-fdl landmark anchors to authed app shell + dashboard (`7b442df`)
- add authed-capture support to design-fidelity.mjs (`5a299b0`)

### [DOCS]
- log demo-invoice null publicToken follow-up (D-4) (`309cb54`)
- D-ADMINCN-E approved+merged; handoff + loop stop (`22456c2`)
- AdminCN decision-#1 already-done finding + Phase E + QA sweep handoff (`ea81e99`)
- record AdminCN decision-#1 already-complete finding + Phase E re-baseline (`3fdc6dc`)
- log v0.16.1 POS image-race fix + release (`6d5345f`)

### [CHORE]
- capture dashboard layout-fidelity baseline (`fcdd765`)


## v0.16.1 — 2026-08-26

### [FIXED]
- show POS grid images stuck invisible from onLoad race (`53ccbae`)


## v0.16.0 — 2026-08-25

### [FEATURE]
- add Product/Offer JSON-LD to product detail page (Rule 35) (`0ea5343`)
- client-side wishlist (localStorage, cart-store pattern) (`9cb888f`)
- re-graft catalog onto Shopix shop grid + filter sidebar (`8e77d3f`)
- re-graft product detail onto Shopix gallery/specs/related (`fd98cef`)
- Shopix-style store landing at /{slug}/store (hero, categories, deals, rails) (`e49c351`)
- re-graft new-sale onto RestroPOS main screen (grid, right panel, checkout, receipt) (`6e45777`)
- storefront router reads for brands, merch content, slugs, availability (`cce422b`)
- reshape demo catalog to Shopix-style 24 products w/ brands, merch content, real photos (`0d3a4f7`)
- add Brand + MerchContent models and ecommerce product/category fields (additive) (`c986656`)
- vendor licensed Shopix demo assets for storefront seed (`666e581`)
- Rule-31 fidelity anchors + baselines for storefront (9 anchors, 3 screens) (`dc76108`)
- add storefront footer per studio mega-footer-05 idiom + white-label credit (`8744c0b`)
- restyle checkout per studio checkout-page-01 + order-summary-04 chrome (`e81db69`)
- restyle order tracking per studio order-summary-03 idiom (`b0b9026`)
- restyle product detail per studio product-overview-07 idiom (`eb8d9cf`)
- restyle catalog per studio product-list-01 + category-filter-04 idiom (`cc10032`)
- restyle cart drawer per studio shopping-cart-02 idiom (`8aeb470`)

### [FIXED]
- retheme demo catalog to match product photos + realistic merchandising (`79b43b3`)
- raise public storefront rate limit 10→60/min per IP (`7470a27`)
- handle nullable-string conditionals explicitly (db seed + studio blocks) (`b6751fd`)
- un-wall /demo/shopix static assets + correct seeded Shopix CTA hrefs (`c0f76f9`)
- allow guest storefront through auth middleware (public-paths regex) (`88190c4`)

### [DOCS]
- add fleet-standard task queue; record seed + rate-limit fixes done (`0033280`)
- template-alignment build session log 2026-08-14 late night (`20d5942`)
- template-audit session log + save-session handoff 2026-08-14 night (`402e3a4`)
- template-alignment spec (Shopix + RestroPOS audits) — HELD pending owner go (`ebe5685`)
- storefront restyle session log 2026-08-14 eve (`95e1c13`)
- storefront restyle execution plan (owner-approved, all defaults) (`e7a7a08`)
- post-release ground truth — v0.15.0 pushed, storefront queued (`bc11124`)

### [TEST]
- extend fidelity anchors + re-capture baselines for template-aligned screens (`695efa3`)


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

