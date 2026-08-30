# Project State — Orqafy

> Auto-maintained by Claude Code after each task. Do NOT edit manually.
> Last updated: 2026-08-28 by CLAUDE_CODE (Full-Auto A→C shipped: D-4=v0.17.0, D-1 Customer Portal MVP=v0.18.0 merged+pushed; found+fixed a 4-day prod outage; deployed v0.18.0 to staging via data-first gate (validated); Squirlnote board populated ORQ-1..12. main @44e9d54 IN SYNC w/ origin. Handoff: .sessions/slot-23/next-session).

---

## ⭐ SESSION 2026-08-28 — Customer Portal shipped + prod outage recovery + staging deploy

```
[FOCUS: Orqafy]  ·  cold-start authority: docs/memory/MEMORY.md → session_d1_customer_portal_mvp_2026-08-28.md
Full handoff (TODO + open decisions + ground truth): .sessions/slot-23/next-session

## ⏳ TODO next session (IN ORDER) — full detail in the slot-23 handoff
1. [x] ✅ DONE 2026-08-30 — Promoted v0.18.0 portal to PRODUCTION (owner-approved). orqafy.com LIVE on sha-0e7ba0f, health 200, portal 307; 2 migrations applied; prod DB backed up first; dev rebuilt (Rule 39).
   STILL PENDING: merge branch fix/orq-11-compose-mem-limits → main (compose limits; HARD HOLD local).
2. [x] [ORQ-11] Compose mem/cpu limits — DONE 2026-08-29 (live docker update + committed 3ac1210, branch HARD HOLD).
3. [x] [ORQ-12] Uptime monitors (3× /api/health + Telegram) — DONE 2026-08-29, all UP/200.
4. [ ] [ORQ-10] favicon.ico 404 (trivial). 5. [ ] Rebuild dev off v0.18.0 (FYI). 6. [ ] [ORQ-13] stale prod MERGED.docker-compose.yml.

## ⚖️ OPEN DECISIONS — surface FIRST
- [ ] Promote v0.18.0 to PROD? (staging green) · Deploy portal to DEMO? · D-1 v2 scope · pre-existing PENDING_DECISIONS (D-3, D-2b, D-PROD-3) · fleet adoptions.

## 🔒 GROUND TRUTH
- main @376ee38, 6 AHEAD of origin (HARD HOLD — fix/orq-11 FF-merged in + session docs; push=release moment, not pushed). v0.17.0+v0.18.0 tags on origin.
- PROD (orqafy.com) + STAGING + DEMO all UP on v0.18.0 (portal) as of 2026-08-30. All healthy. prod/staging tenant slug=powerbyte; demo slug=demo (/demo/portal/login 200).
- Model B no auto-deploy; prod/demo portal deploy = owner word. CI ci.yml red = pre-existing dep-audit only (lint/test/build green).
- ⚠ ALREADY-DONE guard: D-1/D-4/deploy/outage DONE — do NOT re-run. Prod-promote is the only build-ish TODO.
```

---

## ⭐ SESSION 2026-08-27 — AdminCN decision-#1 already complete; Phase E re-baseline + QA (full-auto)

```
[FOCUS: Orqafy]  ·  2026-08-27 ~02:15  ·  cold-start authority: docs/memory/MEMORY.md + this block

## ⏳ TODO — next session works these IN ORDER
1. [x] ✅ DONE 2026-08-27 — D-ADMINCN-E approved by owner; feat/admincn-e-rebaseline FF-merged → local
       main @ea81e99. Branch now integrated; main is a normal held tree awaiting a release word.
2. [ ] (optional polish) favicon.ico 404 — add apps/web/src/app/favicon.ico (agent-found). Trivial.
3. [ ] (owner call) D-SEO — flip genuinely-public surfaces (marketing landing, storefront) from blanket
       noindex → indexable per Rule 35. Outward-facing [WHAT], see PENDING_DECISIONS.md D-SEO.
4. [ ] (owner call, HARD HOLD) Push main → origin? main is 6 commits ahead; a push = release moment
       (version bump + changelog). Needs explicit owner word.

## ⚖️ OPEN DECISIONS (owner) — surface FIRST on resume
- [x] ✅ D-ADMINCN-E — RESOLVED 2026-08-27: owner APPROVED + merged. Do NOT re-surface.
- [ ] D-SEO — public-surface indexing posture (still open). → PENDING_DECISIONS.md
- [ ] (pre-existing, NOT decision #1) Customer Portal MVP (D-1); tenant_super_admin→tenant_superadmin
      fleet-naming reconcile. Both separate from AdminCN scope.

## ✅ DONE THIS SESSION (built AND verified — evidence)
- FINDING: AdminCN adoption (decision #1) was already built+MERGED to main+ratified 2026-08-08
  (feat/admincn-adoption is an ancestor of main; D-A…D-E resolved). Stale "open" tracking corrected. NOT re-built.
- Phase E re-baseline: authed fidelity gate — design-fidelity.mjs authed capture + data-fdl anchors
  (shell+dashboard) + /demo/dashboard baseline. VERIFIED: web typecheck exit 0; gate re-run 8/8 PASS.
  Commits 5a299b0 + 7b442df + fcdd765 (feat/admincn-e-rebaseline).
- Acceptance QA sweep: 19/19 authed modules render clean (no console errors, AdminCN shell, real content);
  light/dark toggle PASS. Only benign favicon 404 (logged).
- Docs recorded: DECISIONS_LOG (2026-08-27), TASK_QUEUE, SESSION_LOG, this block, PENDING_DECISIONS D-ADMINCN-E.

## 🔒 STATE / GROUND TRUTH
- git: main @ea81e99 (feat/admincn-e-rebaseline FF-merged in) · clean tree · 6 commits ahead of origin/main
  · HARD HOLD (never pushed). origin/main = v0.16.1 c0765b4. feat/admincn-e-rebaseline branch retained (merged).
- deferred / owner-attention: D-SEO (public indexing) + optional push-to-origin (release). Loop STOPPED at
  owner request 2026-08-27 — next start is a normal manual resume, not a loop iteration.
- ⚠ ALREADY-DONE guard: AdminCN adoption + RBAC 3-tier are DONE — do NOT re-build/re-retrofit; the
  SessionStart AdminCN/RBAC offers are STALE. Verified in code + git ancestry this session.
```

---

## ⭐ SESSION 2026-08-14 (pm) — THEME Phase 5→7 complete (studio blocks + fidelity gate armed)

```
[FOCUS: Orqafy]  ·  2026-08-14 ~15:40  ·  cold-start authority: docs/memory/MEMORY.md + this block

## ⏳ TODO — next session
1. [ ] Storefront restyle — QUEUED by owner 2026-08-14; awaits shop-design go (see
       PENDING_DECISIONS.md 🛍️ entry: studio eCommerce blocks path, effort M, plan sketched).
2. [ ] Fidelity-gate authed screens — capture harness lacks auth-session support; extend to
       dashboard/reports/etc. (follow-up [HOW], not urgent).

## ⚖️ OPEN DECISIONS (owner)
- [ ] Storefront shop-design go/no-go + look preferences (PENDING_DECISIONS.md).
~~Merge+push~~ = ✅ DONE: **v0.15.0 released+pushed 2026-08-14 pm** (main 746f7b5→a2df600 + tag,
13 commits, version-synced; branch feat/theme-phase5-studio-blocks merged FF + deleted; dev
rebuilt off released main).

## ✅ DONE THIS SESSION (built AND verified — evidence)
- 4 merged branches DELETED on owner word (theme, health-poll, ensure-dev-fresh, chart-hsl).
- PHASE 5 (branch feat/theme-phase5-studio-blocks): studio blocks installed via MCP /cui
  (1b2a3ed/427244e: hero-section-01, features-section-01, cta-section-10, login-page-01,
  register-01, statistics-component-01; registry auth reverse-engineered → components.json
  registries block w/ env-var keys). Landing rebuilt on hero/features/cta (800895c) — SEO
  contract preserved (1 H1, H2 hierarchy, JSON-LD, OG, canonical; verified live), real Orqafy
  copy, logo branded. Auth restyled (a41cf52) — ALL logic verbatim (workspace field, actions,
  slug-debounce), eye-toggle added; live login → /demo/dashboard VERIFIED. Stats track
  ALREADY-DONE (de4fd2e, June) — skipped. Cleanup (776a643): 6 demo routes deleted, unused
  block sources deleted, lucide-react re-banned (0 refs app+lock; navigation-menu → shim).
  Hero rhythm fix (372c0de). Gates: tsc + full build green.
- PHASE 6: dev rebuilt off branch (app 42951 healthy); live QA landing/login/register/dashboard/
  reports — login flow works, no placeholder leak, console error is PRE-EXISTING (also on old
  build). Screenshots: qa-phase5-landing(-final).png, qa-phase5-login.png.
- PHASE 7: DESIGN.md reconciled 238→~350 lines to released theme (ba72a30; corrected mono font =
  Source Code Pro). Rule-31 fidelity gate ARMED FIRST TIME: app had 0 data-fdl anchors ever —
  8 anchors added (landing 6 + login 2), manifest + config (baseUrl :42951), playwright root
  devDep, baselines captured, --report-only 2/2 PASS 0 violations (5c20b21, f51ab38).
  Governance: DECISIONS_LOG (7a6a6de) + CHANGELOG_AI entries.
- Squirlnote: 5 accomplishment rows posted (new fleet logging standard, first Orqafy use).

## 🔒 STATE / GROUND TRUTH (updated post-release, 2026-08-14 ~16:00)
- main @ a2df600 = **v0.15.0 tag, PUSHED** (origin/main in sync). Phase 5-7 branch merged FF +
  deleted. Tree clean (docs commit pending at save).
- dev containers: app+worker healthy + FRESH on released main v0.15.0 (rebuilt post-release;
  sidebar footer shows v0.15.0).
- PROD orqafy.com: v0.13.2 untouched. Staging/demo untouched — v0.14.0/v0.15.0 exist ONLY on
  origin/main + local dev; promotion needs explicit owner word per tier.
- KNOWN LIMITS: fidelity baselines = public screens only (no auth in capture harness);
  Enterprise plan card shows "Free" (seed data, pre-existing, not a UI bug).
```

---

## ⭐ SESSION 2026-08-14 — Decision queue cleared → v0.14.0 released + chart-token bugfix

```
[FOCUS: Orqafy]  ·  2026-08-14 ~14:40  ·  cold-start authority: docs/memory/MEMORY.md + this block

## ⏳ TODO — next session works these IN ORDER
1. [ ] THEME Phase 5 — browse owner's shadcn/studio library via shadcn-studio MCP; integrate
       components/blocks/templates (INHERIT-not-REPLACE, keep tRPC/Prisma/Auth). Branch off main
       (theme branch is MERGED+RELEASED — start fresh feat/ branch). done/verify: typecheck +
       next build green + visual QA.
2. [ ] THEME Phase 7 — reconcile design-contract baseline (docs/DESIGN.md / tokens / MOCKUP) to the
       released oklch theme + multi-hue chart palette + governance (CHANGELOG_AI, DECISIONS_LOG).

## ⚖️ OPEN DECISIONS (owner)
- [ ] PUSH authorization for main@5a353be (fix/chart-hsl-var-oklch, merged to local main, 1 ahead of
      origin) — the hsl(var(--token)) unwrap fix. New work AFTER the v0.14.0 release push; needs its
      own owner word (patch release v0.14.1 or fold into next batch).

## ✅ DONE THIS SESSION (built AND verified — evidence)
- ALL 6 open decisions from 2026-08-13 CLEARED per owner directive ("do all Open owner decisions"):
  theme look APPROVED as-is · multi-hue chart palette ADOPTED+built · fc1a777 MERGED · 2bbdba3
  MERGED · stash@{0} DROPPED (patch archived .sessions/archive/stash0-v31-docs-2026-05-08.patch) ·
  3 held branches MERGED+PUSHED. Recorded in DECISIONS_LOG 2026-08-14.
- 🚀 v0.14.0 RELEASED: main 18999f7→746f7b5 pushed with tag (owner one-word OK on gen-release-notes
  proposal). 12 commits: 4 FEATURE (chart palette f5c5885, hugeicons, theme+fonts, Tailwind v4) +
  3 FIXED + 5 DOCS. Version-synced 10 package.json + sidebar footer. NO deploys (CI Model B) —
  staging/prod/demo still on v0.13.2-era images.
- Chart palette: 5-slot categorical (blue/orange/aqua/yellow/magenta), oklch light+dark, validated
  (dataviz validator: all gates PASS on real surfaces #ffffff/#18181b; light chart-3/4/5 <3:1 →
  relief rule = keep legends/tooltips, noted in globals.css comments).
- fc1a777 LIVE-PROVEN: ensure-dev-fresh.sh ran clean end-to-end (detect stale → rebuild app+worker
  → FRESH). Docker ~/.docker corruption did NOT recur (no workaround needed this run).
- 🐛 NEW BUG found during verify + FIXED: hsl(var(--token)) wrappers invalid since v4/oklch theme
  (silent CSS failure — charts never consumed theme tokens; part of why charts looked grey).
  Fix 5a353be (3 files/17 unwraps: expenses-chart, revenue-chart, sidebar), gates green, merged to
  LOCAL main (1 ahead, UNPUSHED). Lesson logged: css.tailwind-v4.hsl-var-oklch-wrapper.
- E2E visual verify: dev rebuilt on 5a353be, login demo tenant, /demo/reports @ 90d — revenue area
  stroke/fill oklch(0.622 0.161 255.1) blue + expenses bars oklch(0.622 0.173 40.1) orange
  (DOM-computed). Screenshot screenshots/qa-reports-charts-multihue-90d.png.
- Route-count baseline clarified: 102 = page.tsx pages; 121 = full build route table incl. 17 API
  route.ts + generated meta routes. Both correct; not a regression.

## 🔒 STATE / GROUND TRUTH
- git: main @ 5a353be (v0.14.0 tag = 746f7b5 pushed; +1 unpushed fix). Tree clean.
- Branches feat/tailwind-v4-shadcnstudio-theme, fix/push-to-prod-health-poll,
  fix/ensure-dev-fresh-worker-compose, fix/chart-hsl-var-oklch: all MERGED into main (deletable
  on owner word; git-guard blocks -D).
- dev containers: app+worker FRESH on 5a353be, healthy (app 42951, worker 42952).
- PROD orqafy.com: v0.13.2, untouched. Staging/demo: untouched.
```

---

## ⭐ SESSION 2026-08-13 — Tailwind v4 + shadcn/studio "orqafy" theme (Phases 0-3) + v0.13.3 queue

```
[FOCUS: Orqafy]  ·  2026-08-13 ~13:35  ·  cold-start authority: docs/memory/MEMORY.md + this block

## ⏳ TODO — next session works these IN ORDER
1. [ ] THEME Phase 5 — browse owner's shadcn/studio library via shadcn-studio MCP; integrate
       components/blocks/templates onto branch feat/tailwind-v4-shadcnstudio-theme (INHERIT-not-REPLACE,
       keep tRPC/Prisma/Auth). done/verify: typecheck + next build green (102 routes) + visual QA.
2. [ ] THEME Phase 7 — reconcile design-contract baseline (docs/DESIGN.md / tokens / MOCKUP) to the new
       oklch theme + governance (CHANGELOG_AI, DECISIONS_LOG). done/verify: Rule-31 fidelity gate targets
       new theme, not stale baseline.
3. [ ] v0.13.3 #2 push-to-prod polling fix — committed on fix/push-to-prod-health-poll (2bbdba3); awaits
       merge authorization (see open decisions). #3 dev-worker rebuild = DONE.
~~THEME Phase 4 (lucide→hugeicons)~~ = ✅ DONE this session (see below).

## ⚖️ OPEN DECISIONS (owner) — surface FIRST on resume
- [ ] fc1a777 (branch fix/ensure-dev-fresh-worker-compose) — verified-correct Rule-39 worker-compose fix,
      UNMERGED. "Failed live" in v0.13.2 gate only because main ran the OLD unmerged version (proven at
      config layer: main invocation → "undefined service valkey"; fc1a777 → valid). Merge to main? (push = owner-gated)
- [ ] THEME look approval — serif body (Source Serif 4) + zinc-dark + Geist headings. Screenshots delivered
      (login/dashboard/invoices/reports). Keep as-is or adjust? NOW ALSO covers hugeicon glyphs (Phase 4):
      a few mappings are taste (Landmark→Bank, Receipt/ReceiptText→Invoice01/03, ShieldAlert→SecurityWarning,
      ShieldCheck→SecurityCheck, ClipboardList→TaskDaily01, FolderTree→FolderLibrary). Any glyph = 1-line
      change in src/components/ui/icons.tsx (the single shim/mapping file).
- [ ] THEME chart palette — theme ships GREYSCALE zinc chart tokens (chart-1..5). Fine for single-series;
      add distinct multi-hue palette for multi-series/category charts? (couldn't visually confirm — demo data outside 30d window)
- [ ] ORPHANED STASH stash@{0} "framework docs update - pre item 3" (2026-05-08, 13 files, STALE v31
      framework docs — Master_Prompt_v31.md/.clinerules era, superseded by V32.45.1; NOT this session's).
      Drop as stale or keep? git-guard blocks stash ops → needs explicit owner call. DO NOT auto-drop.
- [ ] Merge/push to main of all 3 held branches (theme + 2 fixes) — HARD HOLD, owner word needed.

## ✅ DONE THIS SESSION (built AND verified — evidence)
- THEME Phase 4 — lucide-react → hugeicons, 83 icons / 69 files, via SHIM src/components/ui/icons.tsx
  (owner-approved strategy: call-site JSX untouched, import source only swaps; 1 reviewable mapping file;
  every hugeicons name validated vs the real 6,124 export set). lucide-react removed (app + unused
  packages/ui; lockfile pruned to 0 refs). 2 type seams LucideIcon→IconType. Commits 052152d (migration) +
  517b222 (3 exact-glyph fixes). Gates: tsc ✓ · next build 102 routes ✓ · 0 lucide refs ✓. LIVE-verified:
  dev app rebuilt off 517b222 (port 42951, healthy), /demo/dashboard renders 19 sidebar + 31 total hugeicon
  SVGs, anyLucideClass=false (DOM-confirmed; screenshot tool timed out on this box).
  ⚠ ENV (not code): ~/.docker contexts/meta I/O error + missing docker-credential-desktop.exe broke
  docker build → worked around w/ throwaway DOCKER_CONFIG + legacy builder; may recur until Docker Desktop/WSL restart.
- v0.13.3 #1: DIAGNOSED fc1a777 (correct; proven at config layer). #2: push-to-prod.sh sleep-5+single-curl
  → bounded health-poll (2bbdba3, fix/push-to-prod-health-poll; shellcheck+bash-n green). #3: dev worker
  REBUILT via fc1a777's fixed cmd → running healthy, freshness FRESH.
- THEME Phases 0-3 on feat/tailwind-v4-shadcnstudio-theme (4 commits): plan (5893e7b) · v3.4→v4 codemod +
  3 variant-literal fixes (69dbcc7) · oklch theme + @theme inline + radius/shadow + Geist/Serif/Mono fonts +
  hugeicons/tw-animate deps + components.json zinc/hugeicons (742670b) · plan status (8073b0f). Gates green
  every phase (typecheck + next build 102 routes). Dev rebuilt; visual QA passed on login/dashboard/table/
  reports (screenshots/ orqafy-theme-login-dark, qa-dashboard, qa-invoices-table, qa-reports-charts). No v4
  border/layout regressions. Plan-of-record: docs/TAILWIND_V4_THEME_ADOPTION_PLAN.md.

## 🔒 STATE / GROUND TRUTH
- git: on feat/tailwind-v4-shadcnstudio-theme @517b222 · 7 ahead of origin/main · UNMERGED HARD HOLD.
  (Phase 4 added 052152d + 517b222 on top of the theme commits.) Also fix/push-to-prod-health-poll @2bbdba3
  (1 ahead) · fix/ensure-dev-fresh-worker-compose @fc1a777 (1 ahead). Working tree CLEAN.
- origin/main @18999f7 = v0.13.2 LIVE on orqafy.com — PROD UNTOUCHED this session.
- dev env: all orqafy_dev containers healthy; dev APP rebuilt off 517b222 (FRESH, port 42951). WORKER NOT
  rebuilt this session (apps/web-only change, worker unaffected; its standalone rebuild is the fc1a777-gated
  broken path). Login: workspace demo / webmaster@orqafy.local (owner) or admin@mail.com / pw admin (dev seed).
- deferred/owner-gated: theme merge, 2 fix merges, stash disposition, chart palette, look approval.
- next un-gated action: THEME Phase 5 (MCP blocks) on the theme branch.
- ⚠ ALREADY-DONE guard: #3 dev-worker rebuild + Phases 0-3 are DONE (evidence above) — do not re-run; verify vs git before repeating.
```

---

## ⭐ SESSION 2026-08-08 (LATE PM) — PROD first stand-up COMPLETE → https://orqafy.com LIVE

Owner-authorized irreversible first stand-up (super_admin = webmaster@powerbyteitsolutions.com confirmed).

**✅ DONE — PROD LIVE + verified end-to-end:**
- **Seed prod-safe fix** (`fix/seed-prod-safe` branch, commit `b8bc912`, LOCAL/UNMERGED, HARD HOLD):
  `packages/db/src/seed/index.ts` — gate `seedDemoShowcase()` behind `APP_ENV !== 'production'`; parameterize
  tenant + super admin via env (`SEED_TENANT_SLUG/NAME`, `SEED_SUPERADMIN_EMAIL`, `SEED_TENANT_STATUS`;
  defaults = dev values, backward-compatible; prod status→'active', schemaName→`t_<slug>`). Verified vs 2
  throwaway DBs: prod path = 1 tenant(powerbyte/active)+1 super admin+13 roles+5 plans+0 showcase rows; dev
  default = demo tenant + dev accounts + showcase (products=8). typecheck+lint clean.
- **Stack** `/etc/komodo/stacks/orqafy-prod/` (5 compose files copied from staging + `.env` built server-side,
  49 keys, mode 600). Network `orqafy_prod_network` created. Ports: **DB 5444** (5441 taken by ferrybook →
  changed), redis 6388, minio 9020/9021. Fresh secrets generated server-side (DB/REDIS/AUTH_SECRET/
  APP_ENCRYPTION_KEY[base64-32, boot health-check passed]/MOBILE_JWT_SECRET[64ch]/STORAGE_*). Copied from
  staging: TELEGRAM_* (shared channel), WEBMASTER_PASSWORD (staging_prod vault tier), Turnstile TEST keys.
- **Image** pinned `APP_IMAGE_TAG=sha-e528326` (same immutable image as staging/demo — no retag).
- **DNS** Cloudflare zone orqafy.com: A `orqafy.com` + `www` → 72.62.74.203 proxied (created this session).
- **Migrate** 38 migrations applied via SSH tunnel (manual, `db:migrate:deploy` → "schema up to date").
- **Seed** prod path run over tunnel → powerbyte tenant + webmaster@powerbyteitsolutions.com owner ONLY.
- **🐞 Traefik router-name collision fixed:** app compose hardcodes router name `orqafy_staging_app` (NOT
  env-driven — the STATE plan was wrong). Copying staging verbatim collided with the LIVE staging router →
  404. Fixed: sed `orqafy_staging_app`→`orqafy_prod_app` in prod docker-compose.app.yml; recreated app.
  Global lesson candidate: traefik router/service names hardcoded in orqafy app compose (should be
  `${COMPOSE_PROJECT_NAME}`-scoped) — bit us on demo? (demo worked, so demo's compose differs).
- **www→apex 301** redirect middleware added (`orqafy_prod_www` router + `wwwredir` redirectregex).
- **VERIFIED (evidence, Rule 32):** `/api/health`=200 · `/login`=200 · `www`→301→apex(200) · DB row
  webmaster@powerbyteitsolutions.com active/tenant-owner/tenant_super_admin/powerbyte-active/60ch-bcrypt ·
  **real end-to-end login POST → 302 /powerbyte/dashboard, session cookie set, no error.**
  Login: orqafy.com/login, tenantSlug=`powerbyte`, email=webmaster@powerbyteitsolutions.com, pw=vault.

**⏳ REMAINING (0.6 cleanup + owner-gated) — NEXT:**
1. **▶ RESUME HERE — OWNER-AUTHORIZED (2026-08-09) to proceed NEXT session:** Merge `fix/seed-prod-safe` → main
   = release **v0.12.3** (version+changelog via `gen-release-notes`, then push to main = staging tier). Branch
   has 2 commits: `b8bc912` (prod-safe seed) + `9459343` (this STATE doc). Owner already said "proceed on Item#1
   on the next session" — this is CLEARED to act, not waiting on a decision. Confirm bump (patch → v0.12.3) at
   the release step. The prod seed used the local branch working-tree; main/CI still have the unconditional seed.
2. **[HOW] Store prod secrets in vault** (Server-Setups/Powerbyte-Hostinger) — fresh prod DB/REDIS/AUTH/
   ENC/MOBILE_JWT/STORAGE secrets currently ONLY in server `.env` (disaster-recovery gap). Also MOBILE_JWT_SECRET
   for staging+demo.
3. **[HOW] Turnstile** — prod uses staging TEST keys (captcha always-passes = security downgrade). Create an
   orqafy.com Turnstile site + swap NEXT_PUBLIC_TURNSTILE_SITE_KEY/TURNSTILE_SECRET_KEY.
4. **[HOW] SMTP** — prod SMTP_HOST=localhost placeholder (no real transactional email). Wire real SMTP.
5. **[HOW] Rule 39 dev-freshness** — rebuild local DEV off e528326 (app+worker) so dev isn't stale vs prod.
6. **[HOW] Old *.powerbyte.app** (staging/demo/any prod) → 301 redirects (now 404 after host-rule swap).
7. **[WHAT standing] RBAC 3-tier retrofit** (Scenario 42) + notifications/Valkey SSE realtime bug triage.

---

## ⭐ SESSION 2026-08-08 (PM) — Wave 0 SHIP + domain migration to orqafy.com (owner-authorized)

Program: `docs/BUILD_PROGRAM_2026-08-08.md` (5 waves, one-at-a-time, swarm; ship-now-then-build; root+subdomains).

**✅ DONE:**
- **Pushed main → origin** (was 72 ahead, HARD HOLD lifted by owner "push and ship anything"). Releases:
  `v0.12.0` (AdminCN+SEO+mobile) → `v0.12.1` (fix: pin pnpm@10.11.0 in Dockerfiles — unpinned `npm i -g pnpm`
  floated to a breaking latest, failed `--frozen-lockfile` on @pnpm/exe) → `v0.12.2` (security: next-auth β32 +
  @auth/core 0.41.3 [critical Auth.js fail-open], next 15.5.23, toolchain floors; 2 unpatchable mobile-only
  image-size highs scoped-ignored via pnpm.auditConfig — REVISIT). CI green (Docker + audit) on **e528326**.
  Image `bonitobonita24/orqafy{,-worker}:sha-e528326`.
- **STAGING LIVE → https://staging.orqafy.com** (health+login 200; new image + migrations; Telegram storage).
- **DEMO LIVE → https://demo.orqafy.com** (health+login 200; curated data PRESERVED, reseed-never; 4 pending
  migrations applied via tunnel; MinIO storage).
- Cloudflare DNS (zone orqafy.com `6a6df5f…`, token has access): A `staging`/`demo`.orqafy.com → 72.62.74.203
  proxied. Server .env backed up (`.env.bak-2026-08-08`) per stack.
- **⚠ NEW REQUIRED ENV `MOBILE_JWT_SECRET` (z.string().min(48))** — mobile-auth feature added it; older stacks
  lacked it → app failed env-validation (404/unhealthy) until added. Added per-env (`openssl rand -hex 32`).
  **PROD .env must include it.**

**⏳ PROD (0.5) — RESUME HERE after laptop restart (owner paused to reboot 2026-08-08 ~19:35).**
Owner already said "stand up prod now" — irreversible first stand-up. NO orqafy-prod stack exists yet.
DECISIONS LOCKED by owner:
  • Seed = **owner account + empty tenant** (NO demo data).
  • Storage = **reuse staging's Telegram channel for now** (copy TELEGRAM_BOT_TOKEN + TELEGRAM_DEFAULT_CHANNEL_ID
    from staging .env).
  • First tenant = **slug `powerbyte`, name "Powerbyte IT Solutions"**.
PENDING DECISION (ask on resume, then proceed): prod super_admin identity — RECOMMEND fleet-canonical
  **`webmaster@powerbyteitsolutions.com`** (Server-Setups universal-login staging_prod tier; pw from vault
  `secrets/universal-login-credentials.enc.yaml`). Owner didn't answer (paused to restart).

⚠ SEED BLOCKER (must fix BEFORE prod seed — [HOW], also a good framework fix):
  `packages/db/src/seed/index.ts:229` calls `seedDemoShowcase()` **UNCONDITIONALLY** → would inject FULL demo
  data into prod (contradicts "empty tenant"). Also hardcodes `webmaster@orqafy.local` + tenant slug `demo`.
  FIX: gate `seedDemoShowcase` off when `APP_ENV=production`; parameterize super_admin email + tenant slug/name
  via env (defaults = current dev values, backward-compatible). TEST modified seed against a throwaway DB
  (verify prod path creates tenant+roles+role_perms+plans+super_admin ONLY, zero demo rows) before prod.

PROD STAND-UP STEPS (all [HOW] except the identity confirm above):
  1. Create `/etc/komodo/stacks/orqafy-prod/`; scp repo `deploy/compose/prod/*.yml` (db,cache,storage,app,worker
     — NOT pgadmin/MERGED). Prod app compose uses `${COMPOSE_PROJECT_NAME}_app` router (env-driven — good).
  2. Build prod `.env` from the staging .env template (49 keys — see staging). PROD-specific:
     COMPOSE_PROJECT_NAME=orqafy_prod · APP_DOMAIN=orqafy.com · NEXTAUTH_URL=https://orqafy.com ·
     APP_ENV=production · NODE_ENV=production · APP_IMAGE_TAG=latest · DB_USER/DB_NAME=orqafy_prod ·
     unique ports (staging=5440/6387/9018-19, demo=5439 → prod suggest DB 5441, redis 6388, minio 9020/9021).
     GENERATE fresh (server-side `openssl rand -hex 32`): DB_PASSWORD, REDIS_PASSWORD, AUTH_SECRET,
     APP_ENCRYPTION_KEY, MOBILE_JWT_SECRET (z.string().min(48) — REQUIRED or app 404s), STORAGE_ACCESS/SECRET_KEY.
     COPY from staging: TELEGRAM_BOT_TOKEN, TELEGRAM_DEFAULT_CHANNEL_ID, SMTP_*, TURNSTILE_* (⚠ Turnstile keys
     may be domain-bound to powerbyte.app — verify captcha on orqafy.com, may need a new Turnstile site for the
     domain), DOCKERHUB_USERNAME, IMAGE_NAME, WORKER_IMAGE_NAME, TRAEFIK_NETWORK. WEBMASTER_PASSWORD ← vault.
  3. DNS (Cloudflare zone orqafy.com=`6a6df5f83e8887ead8497a5d53014105`, token=Powerbyte-Hostinger cloudflare.enc):
     A `orqafy.com` + `www` → 72.62.74.203 proxied=true (mirror staging/demo which are DONE).
  4. `docker compose -p orqafy_prod --env-file .env <5 files> up -d postgres valkey minio` (fresh volumes).
  5. Promote image: `docker buildx imagetools create -t …/orqafy:latest -t …:prod-sha-e528326 …:sha-e528326`
     (+ worker). Then `up -d app worker`.
  6. Migrate fresh DB: SSH tunnel local→server prod DB_PORT (use a free local port e.g. 55441; push-to-prod.sh's
     own tunnel step is unreliable — do it manually like the demo migrate that WORKED this session), then
     `DATABASE_URL=<tunnel-url> pnpm --filter @orqafy/db db:migrate:deploy`; confirm "schema is up to date".
  7. SEED (the fixed seed): `APP_ENV=production WEBMASTER_PASSWORD=<vault> SEED_SUPERADMIN_EMAIL=<confirmed>
     SEED_TENANT_SLUG=powerbyte SEED_TENANT_NAME="Powerbyte IT Solutions" DATABASE_URL=<tunnel-url>
     pnpm --filter @orqafy/db db:seed` → creates tenant+roles+plans+super_admin ONLY.
  8. Verify https://orqafy.com/api/health=200, /login=200, login as super_admin; `www`→301.
  9. 0.6 cleanup: old *.powerbyte.app (staging/demo/prod) → 301 redirects; rebuild DEV off e528326 (Rule 39,
     app+worker); store all MOBILE_JWT_SECRET + prod secrets into Server-Setups vault.

DEPLOY MECHANICS PROVEN THIS SESSION (reuse): staging via `deploy/staging-refresh-and-deploy.sh <sha>`;
demo via `deploy/compose/push-to-demo.sh <sha>` (its tunnel-migrate step FAILED — migrate manually via tunnel);
stack is DOWN→bring up infra FIRST (`up -d postgres valkey minio`) then app+worker; add MOBILE_JWT_SECRET to
.env or app 404s; domain swap = sed APP_DOMAIN+NEXTAUTH_URL in .env then `up -d --force-recreate app worker`,
LE cert auto-issues (~40s), verify. CF proxied → browser sees Google-Trust edge cert (normal).

**⏳ 0.6 cleanup (after prod):** old `*.powerbyte.app` (staging/demo) now 404 (Traefik host rule changed) → add
301 redirects. Rebuild dev off e528326 (Rule 39). Store MOBILE_JWT_SECRET values into Server-Setups vault.

---

## ⭐ SESSION 2026-08-08 — resume + verify/ratify AdminCN & SEO, fix SEO middleware bug

**✅ DONE THIS SESSION:**
- **Owner RATIFIED** (post-hoc) the overnight full-auto work already merged to local main (`8cfa127`):
  AdminCN full-site adoption (23 authed modules + platform-admin D) + SEO Foundation (Rule 35). Logged
  in `docs/DECISIONS_LOG.md` (2026-08-08); PENDING_DECISIONS AdminCN + D-SEO items closed.
- **QA verify-all-pages gate run** (Rule 16/32): typecheck 0 · lint clean · prod build exit 0 ·
  **1439 web tests pass** (added 3). Live drive via `next start` + demo-login:
  - SEO: index posture correct per page (public=index, authed/utility=noindex). robots.txt/sitemap.xml/
    privacy now serve 200 with correct content-types.
  - AdminCN: dashboard + CRM/inventory/accounting/settings render the idiom (sidebar shell, PageHeader,
    Card/Table, KPI cards) with real data + `v0.9.0`/Powerbyte white-label footer. **0 console errors**
    (only cosmetic favicon 404). platform-admin correctly access-gated.
- **🐞 REAL BUG found + fixed** (`fix(seo)` `775e6ce`, FF-merged to main): `/robots.txt` + `/sitemap.xml`
  were 307-redirecting crawlers to `/login` — auth middleware allow-list (`isPublic`/`PUBLIC_PATHS`) omitted
  them, silently defeating the whole SEO retrofit. Added `/robots.txt`,`/sitemap.xml`,`/privacy` to
  `apps/web/src/lib/public-paths.ts` + 3 unit tests. Global lesson `nextjs.seo.robots-sitemap-blocked-by-auth-middleware`.

**⏳ OPEN [WHAT] (owner-gated — surfaced, not blocking):**
- **Storefront `/[slug]/store/products` is index:true but auth-gated** (307→login) — deferred D-SEO
  tenant-store nuance AND a "is the public shop actually public?" question. Not fixed unilaterally.
- **D-1 Customer Portal** MVP scope (biggest net-new feature, unbuilt).
- **Storefront restyle** (AdminCN has no shop scaffold) + **E design re-baseline** sign-off (DESIGN.md/MOCKUP, Rule 31).
- **Deploy gate:** 71 commits ahead of origin/main, HARD HOLD. PROD M7 first-time stand-up + RBAC slug
  promotion still gated on explicit owner word. Also standing: 3-tier RBAC retrofit offer; notifications/
  Valkey SSE realtime bug (pre-existing, separate triage).

**NEXT UN-GATED WORK** if resuming: none pressing — verify complete, tree clean. Await owner decision on the
[WHAT] items above. ⚠ Restart Claude Code for V32.45.1 hooks.

---

## ⭐ Gated-queue ship — STAGING TIER COMPLETE, main GREEN+PUSHED (2026-07-19)

**https://orqafy-staging.powerbyte.app** — health 200, login 200, Telegram media backend. Now on the
**CI-built** image (not dev-built) after the first real push→main.

- **`main` @ `d3ad765`** — GREEN (CI all ✓) + PUSHED. Tag `v0.11.0-rc.1` on `6776198` pushed.
  (FF-merged `feat/telegram-storage` 87 commits → main; then CI-fix `6776198`; then reconciliation `d3ad765`.)
- **Fixed a real RED CI on main** (`6776198`): 4 db lint errors + a **latent worker ESM production bug**
  (`ERR_MODULE_NOT_FOUND` on `await import('@orqafy/shared/rbac')` at worker runtime — real .js shim files).
  Global lesson `esm.source-only-shared-pkg.js-reexport-unresolved-at-runtime`.
- **Stack:** `/etc/komodo/stacks/orqafy-staging/` on 72.62.74.203 — postgres 5440 · valkey 6387 ·
  minio 9018/9019 · app (Traefik `orqafy_staging_app`, TLS) · worker. No pgbouncer/pgadmin.
  Image now `bonitobonita24/orqafy{,-worker}:sha-6776198` (deployed via hardened
  `deploy/staging-refresh-and-deploy.sh sha-6776198`, data-first gate; prod-refresh auto-skipped — no prod).
  Live footgun fixed: app+worker compose default `${APP_IMAGE_TAG:-demo-latest}`→`staging-latest`.
- **Storage:** `STORAGE_BACKEND=telegram` (chat_id `-1004449537821`). Creds `webmaster@orqafy.local`
  (slug `demo`), vault `staging_prod` tier. Verify: app healthy, worker logs clean (no ESM crash), /health+/login 200.
- **Compose reconciliation RESOLVED (model a):** repo `deploy/compose/{stage,demo}` mirrored to the live
  hand-placed layout; DECISIONS_LOG locks deploy-model (a) (Komodo/gate-script consume hand-placed stacks;
  repo compose = reference mirror). `docs/DEPLOY_COMPOSE_RECONCILIATION.md` → ✅ RESOLVED.
- **RBAC slug retrofit** `feat/rbac-slug-standardize` @ `6a9ec94` (tenant_super_admin→tenant_superadmin) —
  dev-verified, LOCAL only (unpushed). Rebase on main before promoting (inherits the ESM fix → unblocks worker tests).
- **REMAINING GATED (owner word only):** (1) PROD M7 (`orqafy.powerbyte.app`) — first-time stand-up,
  IRREVERSIBLE, then promote `v0.11.0-rc.1`→`v0.11.0`; (2) RBAC retrofit promotion. See handoff
  `.cline/handoffs/2026-07-19-gated-queue-shipped.md`.

---

## Current Verification (Rule 32 Verifiable-Done evidence)

Latest done-claim: RBAC §4 owner-transfer UI (two-way succession §2) on
`feat/tenant-rbac-3tier` (LOCAL, HARD HOLD, unpushed). Commit f89e689.
This closed the last un-gated [HOW] gap for the RBAC §4 goal.

evidence:
  contract: "web typecheck 0 errors; full web vitest suite green; eslint clean; design anti-slop lint PASS; live Rule-16 QA of owner + non-owner paths with 0 console errors"
  check_command: "pnpm --filter @orqafy/web typecheck && pnpm --filter @orqafy/web test && pnpm --filter @orqafy/web lint && bash scripts/lint-design.sh --report-only apps/web/src"
  captured_output: |
    > @orqafy/web@0.9.0 typecheck
    > tsc --noEmit
    (0 errors)

    Test Files  84 passed (84)
    Tests       1258 passed (1258)

    ✔ No ESLint warnings or errors

    DESIGN ANTI-SLOP SUMMARY  |  files scanned: 256
      Result : PASS  (no AI-slop tells found)

    Live Rule-16 QA (dev :42951, demo tenant):
      - owner (webmaster, is_tenant_owner): sees "Ownership" panel + "Owner"
        badge; dialog lists exactly the 2 eligible members (admin, user),
        confirm gated on selection.
      - non-owner (admin@mail.com, Tenant Super Admin): no panel; Owner badge
        still shown on webmaster row (data-driven). 0 console errors.

---

## Current Phase

**Phase 8 — Iterative Buildout (ongoing)**

All Epics 1–5 complete (confirmed via scout 2026-06-21). V32.9 Compliance & Data Privacy layer merged to main (commit 700e972). Values ratified by owner 2026-06-21 (commit 0e4624b).

---

## HEAD

Branch: `main`
Commit: `0e4624b` — docs(v329): ratify compliance product values (retention 7/5/3, DSR 15d, WCAG 2.2 AA)

---

## Framework Sync

Framework version: **V32.9** (synced 2026-06-20, commit f839050).
All 22 `.ai_prompt/` deliverables match AIEF `specdrivenprompt/` HEAD (diff-clean).
`CLAUDE.md` (app root) = `CLAUDE_v31_compact.md` HEAD. `deploy-v31.sh` present + current.
`.claude/agents/spec-executor.md` = framework HEAD. `.claude/settings.json` has Stop-hook + skill caps.
`scripts/lint-deploy.sh` + `scripts/design-stop-hook.sh` = framework HEAD.

---

## Security Posture

| Layer | Status | Evidence |
|-------|--------|----------|
| L1–L2 HTTPS / Auth.js v5 | ✅ Active | Auth.js v5 session; `securityVersion` in context |
| L3 RBAC | ✅ Active | `middleware/rbac.ts` → `requireRole()`; used in compliance, platform, breach, DSR routers |
| L4 Rate-limit | ✅ Active | `middleware/rate-limit.ts` present |
| L5 AuditLog | ✅ Active | `AuditLog` Prisma model (public schema); used in accounting, compliance, payroll, tasks, crm, project, client, inventory, invoice routers |
| L6 Prisma tenant guardrails | ✅ Active | `tenantId` in tRPC context (`ctx.tenantId`); 20+ routers scope by `tenantId`; tenant-parity tests cover project, client, purchasing, department, tasks, DTR |
| WCAG 2.2 AA gate | ✅ Partial | Quick-wins applied (V32.9 pass); remaining issues documented in `docs/V329_WCAG_REMAINING.md` — pre-existing neutral-dark-theme items (contrast ~5.2:1 AA-passing), sidebar nav landmark, focus trap (Radix handles). No blocking regressions. Gov/LGU gate met at AA level per current theme. |

### Known Tech-Debt: tenant_id migration drift

Multiple `tenant_id` columns were added incrementally via parity migrations (2026-05-31 through 2026-06-19). The guardrails are present in code (routers scope by `ctx.tenantId`) and migrations exist (`20260619000000_add_tenant_id_to_missing_tables`). Deploy-time risk: migration order must be respected on prod apply. **Not a code gap — a deploy sequencing note.** Owner-gated: verify migration history on prod before first deploy.

---

## V32.9 Compliance Layer Status

| Item | Status |
|------|--------|
| `DataSubjectRequest` Prisma model + migration | ✅ `20260620000000_add_compliance_privacy` |
| `BreachRecord` Prisma model + migration | ✅ Same migration |
| `dsrRouter` (dsr.inform/access/rectify/port/requestErasure/object + admin sub-router) | ✅ `apps/web/src/server/trpc/routers/dsr.ts` |
| `compliance.breach.*` router (admin-only, requireRole) | ✅ `apps/web/src/server/trpc/routers/compliance.ts` |
| Privacy notice page (`/privacy`) | ✅ `apps/web/src/app/privacy/page.tsx` |
| Tenant privacy page (`/[slug]/privacy`) | ✅ `apps/web/src/app/(tenant)/[slug]/(app)/privacy/` |
| Breach management UI (`/[slug]/settings/breach`) | ✅ `apps/web/src/app/(tenant)/[slug]/(app)/settings/breach/` |
| `.ai_prompt/privacy.md` cue | ✅ Present + matches framework HEAD |
| Owner-ratified values (retention 7/5/3, DSR 15d, lawful bases, erasure = review) | ✅ DECISIONS_LOG.md 2026-06-21 |

**Owner-gated (not buildable without owner decision):**
- DPO appointment: placeholder `bonitobonita24@gmail.com` in `dsr.inform`. Needs real DPO name/email.
- NPC registration / formal PIA artifact: pending owner confirm at Orqafy's processing scale.

---

## Governance Docs

| Doc | Status |
|-----|--------|
| `docs/PRODUCT.md` | ✅ Present |
| `docs/DECISIONS_LOG.md` | ✅ Current (last entry 2026-06-21, V32.9 ratification) |
| `docs/IMPLEMENTATION_MAP.md` | ✅ Current (Phase 8 Batch 4 complete) |
| `docs/CHANGELOG_AI.md` | ✅ Current (last entry W13 closeout) |
| `.ai_prompt/LESSONS_REGISTRY.md` | ✅ Present + matches framework HEAD |
| `docs/STATE.md` (this file) | ✅ Restored 2026-06-21 (was 0 bytes) |

---

## Test Baseline

```
Test Files  57 passed (57)
Tests       1029 passed (1029)
Duration    ~2.6s
Date        2026-06-21
```

Previous baseline: 845 tests (Phase 7 Epics 1–2), 1029 after V32.9 compliance tests added.

---

## Staging / Prod Deploy State

- **Demo**: LIVE — https://orqafy-demo.powerbyte.app (MinIO storage). Stack `orqafy-demo`.
- **Staging**: ✅ LIVE 2026-07-19 — https://orqafy-staging.powerbyte.app (Telegram storage). Stack
  `orqafy-staging`, image `dev-sha-e8fbb72`. First-ever staging stand-up (greenfield). See "Full-Auto M4"
  block at top for full detail + verification evidence.
- **Prod**: Never deployed (OWNER-GATED — the staging directive did NOT authorize prod). Target
  `orqafy.powerbyte.app`, Telegram storage. Needs explicit owner word + tag 0.11.0 + staging-refresh
  invariants patch. Staging-refresh data-first gate is moot for first prod stand-up (nothing to refresh from).

---

## Phase 8 Remaining (owner-gated)

- DPO appointment email in DSR privacy notice.
- NPC registration / PIA decision.
- WCAG remaining: sidebar nav aria-label + light-theme contrast recheck (if/when light theme added).
- Staging re-deploy with V32.9 migrations (owner-gated on Komodo).
- Browser-interactive Visual QA (gated on `/opt/google/chrome/chrome` install).
