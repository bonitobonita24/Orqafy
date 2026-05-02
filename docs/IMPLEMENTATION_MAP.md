# Implementation Map — Orqafy
# Current build state snapshot. Rewritten after every task.
# Last updated: 2026-05-03 by CLAUDE_CODE (Phase 3 complete)
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
| Phase 4 — Full Scaffold | ⬜ Pending | 8 Parts, fresh session each (Rule 24). Open `.cline/tasks/phase4-part1.md` in new session. |
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
| packages/shared | ⬜ | TypeScript types + Zod schemas — Phase 4 Part 2 |
| packages/api-client | ⬜ | Typed tRPC client — Phase 4 Part 2 |
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
| docs/CHANGELOG_AI.md | ✅ | 5 entries (Bootstrap, Bootstrap Gap Fix, Phase 2, Phase 3, Governance Sync 2026-05-03) |
| docs/DECISIONS_LOG.md | ✅ | 7 decisions (Linear→Sunset→VoltAgent visual evolution + Orqafy rename + feature expansion + Phase 2 + Phase 3) |
| docs/IMPLEMENTATION_MAP.md | ✅ | This file |
| docs/PHASE3_BRIEFING.md | ❌ Removed | Deleted in `3e7bc82` — superseded by framework-native `.claude/rules/phases.md` |
| project.memory.md | ✅ | Updated with skill installations (gitignored) |
| .cline/STATE.md | ✅ | PHASE = "Phase 3 complete" |
| .cline/memory/lessons.md | ✅ | 1 🔴 gotcha pre-seeded (WSL2 + Docker) |
| .cline/memory/agent-log.md | ✅ | All Bootstrap + Phase 2 + Phase 3 + Governance Sync entries |
| CREDENTIALS.md | ✅ | Gitignored. AI-generated values active; ⏳ for human-fill (GitHub, Docker Hub, Turnstile prod, third-party). |

## Skills + MCP

| Tool | Status | Source | Purpose |
|------|--------|--------|---------|
| spec-driven-core | ✅ Active | `.github/skills/spec-driven-core/` (Bootstrap Step 17) | Framework rules card — agent-readable |
| ui-ux-pro-max v2.0.1 | ✅ Active | `.claude/skills/ui-ux-pro-max/` + plugin marketplace symlink | Phase 2.6 design system generation (UI UX Pro Max search.py) |
| planning-with-files | ⚠ Installed (advisory) | `.claude/skills/planning-with-files/` (commit `1495972`) | Manus-style markdown planning — NOT used by V31 framework (uses STATE.md instead) |
| postgres | ⚠ Installed (advisory) | `.claude/skills/postgres/` (commit `1495972`) | Read-only SQL query helper — Phase 4+ optional |
| systematic-debugging | ⚠ Installed (advisory) | `.claude/skills/systematic-debugging/` (commit `1495972`) | Debug methodology — Phase 6.5 / Phase 7 optional |
| test-driven-development | ⚠ Installed (advisory) | `.claude/skills/test-driven-development/` (commit `1495972`) | TDD enforcement — supplements Rule 25 stage-2 review |
| vercel-agent-skills | ⚠ Installed (NOT applicable) | `.claude/skills/vercel-agent-skills/` (commit `1495972`) | Vercel-specific guidance — **NOT used**. Stack locked to Docker Compose + Komodo + Traefik (Rule 28 priority over skill packs) |
| socraticode MCP | ✅ Configured | `.vscode/mcp.json` (Bootstrap Step 10) | Codebase semantic search (Phase 4+) |
| context7 MCP | ✅ Configured | `.vscode/mcp.json` | Live library docs (append "use context7" to prompts — Rule 30) |
| shadcn MCP | ✅ Configured | `.vscode/mcp.json` | Component install via natural language |
| code-review-graph | ⚠ Optional | Per-machine plugin (not installed) | Phase 7 blast-radius — install via `claude plugin add tirth8205/code-review-graph` |
| `.claude/scan-results.json` | ✅ Present (advisory) | Generated by `scan-project` skill (commit `1495972`) | Tech stack snapshot — informational only, no governance role |

## Next Action

Open `.cline/tasks/phase4-part1.md` in a **new Claude Code session** and say
"Start Part 1". Each Phase 4 Part runs in a fresh session per Rule 24
(prevents context accumulation, keeps Claude Sonnet 4.6 output quality high).
