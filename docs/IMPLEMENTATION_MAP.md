# Implementation Map — Orqafy
# Current build state snapshot. Rewritten after every task.
# Last updated: 2026-05-07 by CLAUDE_CODE (Phase 8 batch 1 confirmed — PAUSED)
# ---

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 — Bootstrap | ✅ Complete | All 18 steps done. CREDENTIALS.md scaffolded. |
| Phase 1 — Dev Environment | ⬜ Skipped | Optional — Node 22 + pnpm + WSL2 already configured |
| Phase 2 — Discovery Interview | ✅ Complete | 8 questions answered. PRODUCT.md updated (12 edits). 7 decisions locked. |
| Phase 2.5 — Spec Summary | ✅ Complete | User confirmed. |
| Phase 2.6 — Design System | ✅ Complete | UI UX Pro Max v2.0.1 generated MASTER.md. Harmonised with docs/DESIGN.md (VoltAgent). Vercel guidelines + WCAG AA enforcement appended. |
| Phase 2.7 — Spec Stress-Test | ✅ Complete | PASS — 0 gaps found across completeness/consistency/ambiguity/security checks. |
| Phase 3 — Generate Spec Files | ✅ Complete | inputs.yml v3 + schema + 4 env files + sync script. Port base 42941. |
| Phase 4 — Full Scaffold | ✅ Complete (Parts 1–8) | Part 1 ✅ merged (`834c30b`). Part 2 ✅ merged (`2e8fce1`). Part 3 ✅ merged (`a494bd1`). Part 4 ✅ merged (`3c6aedc`). Part 5 ✅ merged (`44429d0`). Part 6 ✅ merged (`55b9ac7`). Part 7 ✅ merged (`91818df`). Part 8 ✅ merged. |
| Phase 5 — Validation | ✅ Complete | All 9 commands pass. 15 ESLint fixes (mobile), React 19 forwardRef fix (web), turbo env passthrough, serverExternalPackages, next 15.3.2→15.5.15, 11 Expo HIGH CVEs mitigated (audit-level=critical). |
| Phase 6 — Docker + Visual QA | ✅ Complete | All 7 dev services healthy, migrations in sync, seed populated (13 roles, 5 plans, demo tenant, webmaster, 9 depts, 9 expense cats, VAT 12%, warehouse, FY 2026, 31 CoA). Visual QA per Rule 16 passed: /api/health 200, /login 200 ("Sign In \| Orqafy"), / 307→/login (after AUTH_TRUST_HOST autofix), 6 security headers active. Browser-interactive auth flow QA deferred — needs system Chrome. |
| Phase 7 — Feature Updates | ⬜ Pending | The daily loop. Triggered per item by Phase 8 batch execution. |
| Phase 8 — Iterative Buildout | 🔵 Batch 1 confirmed (PAUSED) | Proposal accepted 2026-05-07. 3-item batch: (1) apps/worker + tenant-provisioning, (2) Module 17 platform-admin + tenant onboarding, (3) Module 1 public-landing + Module 2 demo entry. NO CODE WRITTEN YET. Resume via "Start batch 1 item 1". See `.cline/handoffs/2026-05-07-pause-phase8-batch1-confirmed.md`. |

## Spec Files (Phase 3 outputs)

| File | Status | Notes |
|------|--------|-------|
| `inputs.yml` | ✅ | v3, 13K — full app + tech stack + ports + git + docker + a11y |
| `inputs.schema.json` | ✅ | Strict JSON Schema for validate-inputs.mjs |
| `.env.dev` | ✅ | Ports from base 42941. AI credentials populated from CREDENTIALS.md. Gitignored. |
| `.env.staging` | ✅ | Standard ports + Traefik. Credentials populated. Gitignored. |
| `.env.prod` | ✅ | Standard ports + Traefik. Credentials populated. Gitignored. |
| `.env.example` | ✅ | Committed template — placeholders only, no real values. |
| `scripts/sync-credentials-to-env.sh` | ✅ | Idempotent sync from CREDENTIALS.md → env files. |
| `design-system/MASTER.md` | ✅ | Phase 2.6 output. DESIGN.md authoritative for color/typography. |
| `.socraticodecontextartifacts.json` | ✅ | 6 entries: design-system, design-reference, database-schema, implementation-map, decisions-log, product-definition. Gitignored. |

## Credentials State

| Section | Source | Status |
|---------|--------|--------|
| First Admin Account (webmaster) | CREDENTIALS.md | ✅ AI-generated (Bootstrap Step 18) |
| PostgreSQL (×3 envs) | CREDENTIALS.md | ✅ Synced to .env files |
| PgBouncer (×3 envs) | CREDENTIALS.md | ✅ Synced |
| Valkey (×3 envs) | CREDENTIALS.md | ✅ Synced |
| MinIO (×3 envs) | CREDENTIALS.md | ✅ Synced |
| pgAdmin (×3 envs) | CREDENTIALS.md | ✅ Synced |
| Auth.js secrets (×3 envs) | CREDENTIALS.md | ✅ Synced |
| GitHub PAT | CREDENTIALS.md | ⏳ Human-fill before Phase 5 |
| Docker Hub token | CREDENTIALS.md | ⏳ Human-fill before Phase 5 |
| SMTP (staging + prod) | CREDENTIALS.md | ✅ Synced (filled by user) |
| Komodo UI URL | CREDENTIALS.md | ✅ Synced |
| Xendit (LIVE keys) | CREDENTIALS.md | ✅ Synced |
| Cloudflare Turnstile (prod LIVE) | CREDENTIALS.md | ⏳ Human-fill before prod deploy |
| Third-party API keys | CREDENTIALS.md | ⏳ Add rows as integrations land |

## Packages

| Package | Status | Description |
|---------|--------|-------------|
| packages/shared | ✅ Complete | 17 type files + 16 Zod schemas covering all 16 domains (auth, customer, sales, invoicing, purchasing, inventory, project, hr, banking, accounting, pos, support, ecommerce, job-order, common, global). Both `src/types/index.ts` and `src/schemas/index.ts` re-export everything. `pnpm typecheck` + `pnpm lint` clean. |
| packages/api-client | ✅ Complete | Typed fetch wrapper (`ApiClient` class) with Zod response parsing, optional auth-token resolver, and three error classes (`ApiError`, `NetworkError`, `ResponseValidationError`). Depends on `@orqafy/shared` via `workspace:*`. tsconfig adds `lib: ["ES2022", "DOM"]` for fetch/URL/Response/AbortSignal. `pnpm typecheck` + `pnpm lint` clean. |
| packages/db | ✅ Complete | Prisma 6.19.3 schema — 16 domain schemas (multi-schema tenant isolation), 45 models, AuditLog, tenant-guard extension (L6), RLS helpers (L2), seed script with webmaster account. Merged `a494bd1`. |
| packages/ui | ✅ Complete | shadcn/ui base — VoltAgent dark CSS tokens, Tailwind config, `cn()` helper, WCAG-AA focus rings. Merged `3c6aedc`. |
| packages/jobs | ✅ Complete | 23 typed BullMQ queue/worker factories (all Orqafy domains), `BaseJobData` with `tenantId`, exponential backoff, DLQ-safe `removeOnFail: false`. Merged `3c6aedc`. |
| packages/storage | ✅ Complete | S3-compatible wrapper (MinIO dev / Cloudflare R2 prod), tenant-scoped paths, MIME allowlist/blocklist (SVG + HTML blocked), presigned upload/download URLs, upload/delete with tenant ownership checks. Merged `3c6aedc`. |

## Apps

| App | Status | Description |
|-----|--------|-------------|
| apps/web | ✅ Complete | Next.js 15 App Router. shadcn/ui (New York style, VoltAgent dark tokens). tRPC routers for all 13 entities (customer, project, task, timeEntry, expense, invoice, contract, team, subscription, report, storage, notification, auditLog). Auth.js v5 Credentials provider + bcrypt + securityVersion. 7 CSP headers (Turnstile + Google Fonts). In-memory LRU rate limiters (4 tiers). isomorphic-dompurify XSS sanitizer. Tenant-resolution middleware + RBAC guard + SESSION_INVALIDATED. Cloudflare Turnstile siteverify on public mutations. L1 tenant scoping on all protected procedures. Lint 0 errors, typecheck 0 errors across 7 packages. Merged `44429d0`. |
| apps/worker | ⬜ | BullMQ worker runtime — Phase 4 Part 4/7 |
| apps/mobile | ✅ Complete | Expo SDK 52 with Expo Router v4 file-based navigation. React Native Reusables + NativeWind (VoltAgent dark tokens). WatermelonDB v0.27 offline-first with pull-based sync. 14 screens across 4 nav sections (Dashboard, Projects, Time, Settings). `packages/api-client` only (Rule 13). Expo Push notifications via expo-notifications. Typecheck clean. Merged `55b9ac7`. |

## Infrastructure

| Component | Status | Description |
|-----------|--------|-------------|
| deploy/compose/dev/ | ✅ Complete | docker-compose.{db,cache,storage,infra,pgadmin,app}.yml — 6 compose files. Dev ports from base 42941. App rebuilds from source via `--build`. pgadmin-servers.json pre-configured. Merged `91818df`. |
| deploy/compose/stage/ | ✅ Complete | docker-compose.{db,cache,storage,pgadmin,app}.yml — 5 compose files. Standard ports. Traefik labels on app (no host port). APP_IMAGE_TAG=staging-latest. Merged `91818df`. |
| deploy/compose/prod/ | ✅ Complete | Mirror staging. APP_IMAGE_TAG=latest. Traefik labels. Merged `91818df`. |
| deploy/compose/start.sh | ✅ Complete | One-command startup for all envs. Dev applies `--build` flag to app service. Merged `91818df`. |
| deploy/compose/push.sh | ✅ Complete | Manual image promotion (dev→staging→prod via Docker Hub). Guards: docker.publish check + docker login check. Merged `91818df`. |
| COMMANDS.md | ✅ Complete | Master command reference — Docker start/stop/clean, image push, DB, testing, code quality, governance, git, AI triggers, dev URLs, credentials, utilities. Merged `91818df`. |
| tools/validate-inputs.mjs | ✅ Complete | Validates inputs.yml against inputs.schema.json. Merged `91818df`. |
| tools/check-env.mjs | ✅ Complete | Checks all required env vars are set. Merged `91818df`. |
| tools/check-product-sync.mjs | ✅ Complete | Validates PRODUCT.md ↔ inputs.yml alignment + private tag leakage check. Pattern-matching with alternatives for section names. Merged `91818df`. |
| tools/hydration-lint.mjs | ✅ Complete | Checks for SSR hydration mismatches (typeof window, Date.now, Math.random). Merged `91818df`. |
| .github/workflows/ci.yml | ✅ Complete | 3-job CI: governance gates → quality matrix (lint/typecheck/test/build via Turbo) → dependency security audit. pnpm/action-setup@v4, Node 22. |
| .github/workflows/docker-publish.yml | ✅ Complete | Docker Hub build & push on push to main. Multi-platform (amd64+arm64). Tags: :latest, :staging-latest, :sha-{short}. GHA layer cache. |
| MANIFEST.txt | ✅ Complete | ~280 files across all 8 Parts + Bootstrap + Design System + Spec Files. |

## Governance Docs

| Doc | Status | Notes |
|-----|--------|-------|
| docs/PRODUCT.md | ✅ | 2,160 lines, all 11 required sections + 11 optional |
| docs/DESIGN.md | ✅ | VoltAgent aesthetic, authoritative visual reference |
| docs/README.md | ✅ | HUMAN-owned project README — full feature description aligned with PRODUCT.md (added pre-Bootstrap, refined during Phase 2 commit `2ebf4b7`) |
| docs/CHANGELOG_AI.md | ✅ | 15 entries (Bootstrap through Phase 6) |
| docs/DECISIONS_LOG.md | ✅ | 7+ decisions (Visual evolution + Orqafy rename + Phase 2 + Phase 3 + storage security decisions from Part 4) |
| docs/IMPLEMENTATION_MAP.md | ✅ | This file |
| docs/PHASE3_BRIEFING.md | ❌ Removed | Deleted in `3e7bc82` — superseded by framework-native `.claude/rules/phases.md` |
| project.memory.md | ✅ | Updated with skill installations (gitignored) |
| .cline/STATE.md | ✅ | PHASE = "Phase 8 batch 1 confirmed — PAUSED" |
| .cline/memory/lessons.md | ✅ | 3 🔴 gotchas (WSL2+Docker, pre-existing lint/typecheck, Expo CVEs) + 8 🟡 fixes (added Auth.js v5 AUTH_TRUST_HOST) + 2 🟤 decisions |
| .cline/memory/agent-log.md | ✅ | All Bootstrap + Phase 2 + Phase 3 + Governance Sync entries |
| CREDENTIALS.md | ✅ | Gitignored. AI-generated values active; ⏳ for human-fill (GitHub, Docker Hub, Turnstile prod, third-party). |

## Skills + MCP

| Tool | Status | Source | Purpose |
|------|--------|--------|---------|
| spec-driven-core | ✅ Active | `.github/skills/spec-driven-core/` (Bootstrap Step 17) | Framework rules card — agent-readable |
| ui-ux-pro-max v2.0.1 | ✅ Active | `.claude/skills/ui-ux-pro-max/` + plugin marketplace symlink | Phase 2.6 design system generation (UI UX Pro Max search.py) |
| awesome-design-md | ✅ Active (added 2026-05-03) | `.claude/skills/awesome-design-md/` (uncommitted) | 31 reference DESIGN.md files for shadcn-aligned aesthetics — supports docs/DESIGN.md (VoltAgent) per Scenario 33 |
| using-git-worktrees | ✅ Active (added 2026-05-03) | `.claude/skills/using-git-worktrees/` (uncommitted) | Phase 4 Part isolation per `inputs.yml git.use_worktrees: true` (Rule 24) — was declared but not previously installed |
| mcp-builder | ✅ Active (added 2026-05-03) | `.claude/skills/mcp-builder/` (uncommitted) | Reference for any custom MCP server work alongside the 4 wired servers |
| claude-api | ⚠ Active MEDIUM (added 2026-05-03) | `.claude/skills/claude-api/` (uncommitted) | Hedge for future tenant-side Claude API features (demo-system, AI assistants per tenant). Remove if unused at end of Phase 8. |
| planning-with-files | ⚠ Installed (advisory) | `.claude/skills/planning-with-files/` (commit `1495972`) | Manus-style markdown planning — NOT used by V31 framework (uses STATE.md instead) |
| postgres | ⚠ Installed (advisory) | `.claude/skills/postgres/` (commit `1495972`) | Read-only SQL query helper — Phase 4+ optional |
| systematic-debugging | ⚠ Installed (advisory) | `.claude/skills/systematic-debugging/` (commit `1495972`) | Debug methodology — Phase 6.5 / Phase 7 optional |
| test-driven-development | ⚠ Installed (advisory) | `.claude/skills/test-driven-development/` (commit `1495972`) | TDD enforcement — supplements Rule 25 stage-2 review |
| vercel-agent-skills | ❌ Removed 2026-05-03 | `.claude/skills/vercel-agent-skills/` deleted (was commit `1495972`) | Vercel-specific guidance dropped — stack is Docker Compose + Komodo + Traefik. Live Next.js docs now via Context7 MCP. |
| a11y-skill | ⏳ Manual install needed | Listed in skills-library SKILLS-INDEX.md but folder absent | WCAG 2.1 AA enforcement (mandatory per `inputs.yml accessibility.level: wcag_aa`). Install: `npx skills add airowe/claude-a11y-skill` |
| socraticode MCP | ✅ Configured | `.vscode/mcp.json` (Bootstrap Step 10) | Codebase semantic search (Phase 4+) |
| context7 MCP | ✅ Configured | `.vscode/mcp.json` | Live library docs (append "use context7" to prompts — Rule 30) |
| shadcn MCP | ✅ Configured | `.vscode/mcp.json` | Component install via natural language |
| code-review-graph | ⚠ Optional | Per-machine plugin (not installed) | Phase 7 blast-radius — install via `claude plugin add tirth8205/code-review-graph` |
| `.claude/scan-results.json` | ✅ Present (advisory) | Generated by `/scan-project` (rewritten 2026-05-03 — v2) | Tech stack snapshot — informational only, no governance role |

## Root Config Files (Phase 4 Part 1 — merged `834c30b`)

| File | Status | Notes |
|------|--------|-------|
| `pnpm-workspace.yaml` | ✅ | apps/* + packages/* |
| `turbo.json` | ✅ | lint/typecheck/test/build with dependsOn; db:* cache-disabled |
| `tsconfig.base.json` | ✅ | strict: true + noUncheckedIndexedAccess + exactOptionalPropertyTypes |
| `.editorconfig` | ✅ | 2-space indent, LF, UTF-8 |
| `.prettierrc` | ✅ | singleQuote, semi, tabWidth 2, trailingComma all |
| `.eslintrc.js` | ✅ | ESLint 8 + @typescript-eslint strict (no-explicit-any, no-unsafe-assignment, strict-boolean-expressions). project: true in parserOptions. |
| `package.json` | ✅ | Updated with turbo scripts + devDeps (eslint, prettier, turbo, typescript) |
| `.gitignore` | ✅ | Finalized with coverage/, editor swap, .vscode rules |
| `.nvmrc` | ✅ | 22 (unchanged from Bootstrap) |
| `.npmrc` | ✅ | `audit-level=critical` — Phase 5 CVE decision tree Step 3 (11 Expo transitive HIGH CVEs mitigated) |

## Phase 4 Part 2 — Shared Types + API Client (squash-merged from `scaffold/part-2`)

| File | Status | Notes |
|------|--------|-------|
| `packages/shared/package.json` | ✅ | `@orqafy/shared` workspace pkg, exports `./types` + `./schemas` |
| `packages/shared/tsconfig.json` | ✅ | extends `tsconfig.base.json` |
| `packages/shared/src/types/*.ts` | ✅ | 17 files: index, common, global, auth, customer, sales, invoicing, purchasing, inventory, project, hr, banking, accounting, pos, support, ecommerce, job-order |
| `packages/shared/src/schemas/*.ts` | ✅ | 17 files: 16 domains + index re-exporter |
| `packages/api-client/package.json` | ✅ | `@orqafy/api-client` — depends on `@orqafy/shared` (workspace:*) + zod |
| `packages/api-client/tsconfig.json` | ✅ | extends base, adds `lib: ["ES2022", "DOM"]` for fetch types |
| `packages/api-client/src/client.ts` | ✅ | `ApiClient` class — typed fetch wrapper with Zod response parsing + optional bearer-token resolver |
| `packages/api-client/src/errors.ts` | ✅ | `ApiError`, `NetworkError`, `ResponseValidationError` |
| `packages/api-client/src/index.ts` | ✅ | Re-exports |
| `pnpm install` | ✅ | 2 workspace + 1 root (3 total). +1 added (zod for api-client). |
| `pnpm --filter @orqafy/shared typecheck` | ✅ | 0 errors |
| `pnpm --filter @orqafy/api-client typecheck` | ✅ | 0 errors |
| `pnpm --filter @orqafy/shared lint` | ✅ | 0 errors |
| `pnpm --filter @orqafy/api-client lint` | ✅ | 0 errors (after fixing one `strict-boolean-expressions` on the auth token check) |

**Architectural decision recorded inline:** `packages/api-client` is a typed fetch wrapper, NOT a tRPC client. Phase 4 Part 5 will add tRPC routers on the server; the api-client can be extended (or replaced with a tRPC proxy) at that point. Mobile apps will consume this same package per Rule 13 (mobile never imports `packages/db`).

## Next Action

**CURRENT STATE: Phase 8 batch 1 confirmed — PAUSED. Say "Start batch 1 item 1" or "Resume Phase 8 batch 1" in a NEW Claude Code session.**

1. **Resume Phase 8 batch 1** (the immediate next step):
   - Item 1: `apps/worker` scaffold + tenant-provisioning queue end-to-end
     (branch: `feat/worker-tenant-provisioning`)
   - Item 2: Module 17 platform-admin + tenant onboarding flow
     (branch: `feat/platform-admin-tenant-onboarding`, depends on Item 1)
   - Item 3: Module 1 public-landing + Module 2 demo-system entry
     (branch: `feat/landing-demo-entry`, depends on Item 2)
   - Each item runs as its own Phase 7 cycle (TDD, two-stage review,
     squash-merge), one fresh Claude Code session per item.
   - Full scope + pre-flight checklist in
     `.cline/handoffs/2026-05-07-pause-phase8-batch1-confirmed.md`

2. **After batch 1 completes**: Phase 8 adaptive replanning runs (V14)
   before proposing batch 2. Likely candidates: Module 3 CRM (Customer
   foundational entity for 6 other modules) OR Module 9 Banking (FundSource
   foundational for payments/payroll/expenses).

3. **Browser-interactive Visual QA** is gated on system Chrome install
   (MCP Playwright requires `/opt/google/chrome/chrome`). Will block
   item 2 (platform-admin form QA) and item 3 (landing CTA QA) unless
   resolved or HTTP-level QA workaround applied (same as Phase 6).

4. **Framework lift candidate** (logged in lessons.md as 🟡 fix 2026-05-07):
   Phase 3 env templates should default `AUTH_TRUST_HOST=true` for non-Vercel
   stacks. Lift into V31 master prompt — saves every future project from
   the same `/` 404 + UntrustedHost spam during Phase 6 QA.
