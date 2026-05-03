# Implementation Map — Orqafy
# Current build state snapshot. Rewritten after every task.
# Last updated: 2026-05-03 by CLAUDE_CODE (skills reorg session — Part 2 PARTIAL on scaffold/part-2)
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
| Phase 4 — Full Scaffold | ⏳ In Progress (Part 2 PARTIAL — PAUSED) | Part 1 ✅ merged (`834c30b`). Part 2 ⏳ on `scaffold/part-2`: 17 types written in `packages/shared/src/types/`, 6/16 schemas written, `packages/api-client/` folder exists but empty. Parts 3–8 ⬜. Next: resume Part 2 in fresh session. |
| Phase 5 — Validation | ⬜ Pending | Human trigger. Pre-flight will check CREDENTIALS.md ⏳ status. |
| Phase 6 — Docker + Visual QA | ⬜ Pending | Human trigger. |
| Phase 7 — Feature Updates | ⬜ Pending | The daily loop. |
| Phase 8 — Iterative Buildout | ⬜ Pending | |

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
| `.socraticodecontextartifacts.json` | ✅ | 2 entries: design-system, design-reference. Gitignored. |

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
| packages/shared | ⏳ PARTIAL | 17 type files written (auth, customer, sales, invoicing, purchasing, inventory, project, hr, banking, accounting, pos, support, ecommerce, job-order, common, global, index). 6 of 16 Zod schemas written (auth, customer, sales, invoicing, common, global). 10 schemas outstanding: purchasing, inventory, project, hr, banking, accounting, pos, support, ecommerce, job-order. Untracked on `scaffold/part-2`. |
| packages/api-client | ⏳ EMPTY | Folder created on `scaffold/part-2` but no `package.json`/`tsconfig.json`/source files yet. Typed tRPC client to be written next. |
| packages/db | ⬜ | Prisma schema + migrations — Phase 4 Part 3 |
| packages/ui | ⬜ | shadcn/ui components — Phase 4 Part 4 |
| packages/jobs | ⬜ | BullMQ job queues (23 queues) — Phase 4 Part 4 |
| packages/storage | ⬜ | MinIO/R2 file storage — Phase 4 Part 4 |

## Apps

| App | Status | Description |
|-----|--------|-------------|
| apps/web | ⬜ | Next.js — Phase 4 Part 5 (97 pages per PRODUCT.md mobile strategy table) |
| apps/worker | ⬜ | BullMQ worker runtime — Phase 4 Part 4/7 |
| apps/mobile | ⬜ | Expo (Orqafy Mobile, enterprise distribution) — Phase 4 Part 6 |

## Infrastructure

| Component | Status | Description |
|-----------|--------|-------------|
| deploy/compose/dev/ | ⬜ | docker-compose.{db,cache,storage,infra,pgadmin,app}.yml — Phase 4 Part 7 |
| deploy/compose/stage/ | ⬜ | + Traefik labels, no host ports on app — Phase 4 Part 7 |
| deploy/compose/prod/ | ⬜ | Mirror staging — Phase 4 Part 7 |
| deploy/compose/start.sh | ⬜ | Phase 4 Part 7 |
| deploy/compose/push.sh | ⬜ | Manual image promotion (dev→staging→prod) — Phase 4 Part 7 |
| COMMANDS.md | ⬜ | Master command reference — Phase 4 Part 7 |
| tools/ | ⬜ | validate-inputs.mjs, check-env.mjs, check-product-sync.mjs — Phase 4 Part 7 |
| .github/workflows/ci.yml | ⬜ | Governance + quality + security audit — Phase 4 Part 8 |
| .github/workflows/docker-publish.yml | ⬜ | Docker Hub :latest + :staging-latest + :sha — Phase 4 Part 8 |

## Governance Docs

| Doc | Status | Notes |
|-----|--------|-------|
| docs/PRODUCT.md | ✅ | 2,160 lines, all 11 required sections + 11 optional |
| docs/DESIGN.md | ✅ | VoltAgent aesthetic, authoritative visual reference |
| docs/README.md | ✅ | HUMAN-owned project README — full feature description aligned with PRODUCT.md (added pre-Bootstrap, refined during Phase 2 commit `2ebf4b7`) |
| docs/CHANGELOG_AI.md | ✅ | 7 entries (Bootstrap, Bootstrap Gap Fix, Phase 2, Phase 3, Governance Sync, Phase 4 Part 1, Skills Reorg 2026-05-03) |
| docs/DECISIONS_LOG.md | ✅ | 7 decisions (Linear→Sunset→VoltAgent visual evolution + Orqafy rename + feature expansion + Phase 2 + Phase 3) |
| docs/IMPLEMENTATION_MAP.md | ✅ | This file |
| docs/PHASE3_BRIEFING.md | ❌ Removed | Deleted in `3e7bc82` — superseded by framework-native `.claude/rules/phases.md` |
| project.memory.md | ✅ | Updated with skill installations (gitignored) |
| .cline/STATE.md | ✅ | PHASE = "Phase 4 Part 2 PARTIAL — PAUSED" (corrected 2026-05-03 from stale "Part 1 complete / branch=main" — actual branch is scaffold/part-2 with packages/ untracked) |
| .cline/memory/lessons.md | ✅ | 1 🔴 gotcha pre-seeded (WSL2 + Docker) |
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

## Next Action

**Two threads, run in this order:**

1. **Thread A (low-risk, optional first):** Commit the 2026-05-03 skills reorg as its own
   chore commit on a separate branch off `main` (so the audit trail stays clean and the
   change does not get coupled to Part 2's eventual squash-merge). Full step-by-step in
   `.cline/handoffs/2026-05-03-pause-skills-reorg.md`.

2. **Thread B (the main work):** Open `.cline/tasks/phase4-part2.md` in a **new Claude Code session**
   and resume Part 2 from its PARTIAL state on branch `scaffold/part-2`:
   - 19 type files already in `packages/shared/src/types/`
   - 6/16 schemas done — write the 10 missing: purchasing, inventory, project, hr,
     banking, accounting, pos, support, ecommerce, job-order
   - Create `packages/api-client/` from scratch (not started yet)
   - `pnpm install --frozen-lockfile` → `pnpm typecheck` → squash-merge per Rule 23

   Each Phase 4 Part runs in a fresh session per Rule 24 (prevents context accumulation,
   keeps Claude Sonnet 4.6 output quality high).

3. **Before Phase 7 (or earlier if Phase 4 Part 5 UI work starts):** Manually install
   `a11y-skill` via `npx skills add airowe/claude-a11y-skill` to satisfy the
   `inputs.yml accessibility.level: wcag_aa` + `enforce_pre_delivery_checklist: true` requirement.
