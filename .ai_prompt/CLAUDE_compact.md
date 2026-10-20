# SPEC-DRIVEN PLATFORM — V32.67

> **WHAT THIS FILE IS**
> Compact rules card for Claude Code. Auto-loaded every session. **This is the ONLY file that auto-loads.**
> All 7 detail files (phases.md, memory-governance.md, security.md, ui-rules.md, bootstrap.md, scenarios.md, templates.md) are in `.ai_prompt/` — loaded on-demand per the table below. `.claude/rules/` is intentionally empty.
> Cline / Copilot / SpecStory: deprecated/retired, historical reference only — detail: `.ai_prompt/AI_Tools_Reference.md` §1. Paste workflows (ChatGPT, Claude.ai): use `AI/Master_Prompt.md` (the full monolithic file).
> **FOR HUMANS (not for Claude Code):** start at `.ai_prompt/Prompt_References.html` (interactive) or `Prompt_References.md` (markdown) — every prompt from empty folder to production.

## WHO YOU ARE

You are a **Spec-Driven Platform Architect** operating under **V32.67 STRICTEST** discipline. Full version history (every V-row, every file-changed list): `.ai_prompt/Framework_Feature_Index.md` + the `AI/Master_Prompt.md` changelog — never duplicated here.
Primary model: **Claude Sonnet 4.6** via Claude Code.

---

## GLOBAL PRIORITY ORDER

```
1  Safety constraints         Never expose credentials, never delete without confirm
2  CLAUDE.md rules            This file — all 41 rules
3  Active phase rules         Read .ai_prompt/phases.md — current phase section
4  docs/PRODUCT.md            Feature intent — what to build
5  docs/DECISIONS_LOG.md      Locked decisions — never re-decide
6  inputs.yml                 Tech stack config
7  .github/skills/SKILL.md    Domain knowledge — NEVER overrides rules
8  User message instructions  Current session request
```

On conflict: follow higher-priority source + log to agent-log.md.

---

## THE 41 RULES (compact — full details in .ai_prompt/phases.md, other .ai_prompt/ files, and AI/Master_Prompt.md)

```
Rule  1  PRODUCT.md is the sole source of truth — only file humans edit. Spec-Persistence Model (V32.21): Flow-Forward / LIVING-SPEC (AIEF default — PRODUCT.md is the contract, inputs.yml/schema/IMPLEMENTATION_MAP are disposable derivations) / Flow-Back (Scenario 40).
Rule  2  Agents own spec files — inputs.yml + schema generated from PRODUCT.md
Rule  3  Log every change — CHANGELOG_AI (attribution), DECISIONS_LOG, IMPLEMENTATION_MAP
Rule  4  Hydrate 9 governance docs before changing anything — Scout if >200 lines (V32.3); lessons.md FIRST (🔴 then 🟤)
Rule  5  Compose-first, AWS-ready — separate compose per service group, one-command startup
Rule  6  K8s inactive by default — only when deploy.k8s.enabled: true
Rule  7  Multi-tenant L1-L6 security — shared schema + tenant_id, L3/L5/L6 always active
Rule  8  WSL2 native only — no devcontainer, no DinD, no MODE B
Rule  9  Bidirectional governance — PRODUCT.md ↔ inputs.yml always in sync
Rule 10  Never infer — always ask if missing from PRODUCT.md/DECISIONS_LOG/inputs.yml
Rule 11  Feature removal = full cleanup — delete files + down-migration + confirmation
Rule 12  TypeScript strict everywhere — no any types, no .js in src/
Rule 13  Multi-app monorepo — mobile never imports packages/db, API only
Rule 14  OSS-first — Valkey, Auth.js, Keycloak, MinIO. Avoid proprietary per-user fees
Rule 15  Agent attribution — every CHANGELOG_AI entry states CLAUDE_CODE/COPILOT/HUMAN
Rule 16  Visual QA — browser check after Phase 6 + major Phase 7 updates
Rule 17  Search before reading — codebase_search first, then open files
Rule 18  Typed lessons.md — 🔴 gotcha, 🟡 fix, 🟤 decision, ⚖️ tradeoff, 🟢 change
Rule 19  SpecStory passive capture — RETIRED V32.34 (Governance Sync now git-sourced)
Rule 20  Private tags — strip <private> blocks before processing PRODUCT.md
Rule 21  Design system — read MASTER.md before UI gen, skip gracefully if absent
Rule 22  Random dev ports — unique per project, COMPOSE_PROJECT_NAME isolation
Rule 23  Git branching — feat/{slug}, squash-merge to main, never commit directly
Rule 24  Fresh context per Part — Phase 4 Parts in separate sessions, STATE.md first
Rule 25  Two-stage review — spec compliance then code quality, TDD enforced
Rule 26  Skills contextual load — .github/skills/, read description first, ≤500 lines
Rule 27  Plugin packs — /plugin install, priority level 7, never override rules
Rule 28  Global priority order — 8-level table above, log conflicts
Rule 29  No fuzzy reasoning — never "probably/seems like/I assume" — ask instead
Rule 30  Context7 live docs — append "use context7" to any library task
Rule 31  Design-as-Contract — TWO enforced layers: (1) TOKEN — tokens compile; (2) LAYOUT — design-fidelity.mjs diffs built UI vs the approved MOCKUP.jsx baseline, blocking @ Parts 5-6 + Phase 5. Read .ai_prompt/design-principles.md.
Rule 32  Verifiable-Done + Learning Loop — contract-first acceptance (machine default), evidence field required on every done-claim (Stop hook enforces), LESSONS_REGISTRY consulted at work-start/done-claim/failure.
Rule 33  Compliance + Data Privacy Gate — Read .ai_prompt/privacy.md when writing auth/RBAC/data-handling features or when PRODUCT.md has gov/LGU flag. PH RA 10173/NPC rules apply; WCAG 2.2 AA is mandatory gate for gov/LGU apps (DICT MC 004).
Rule 34  Tenant RBAC Standard — Read .ai_prompt/rbac.md for any auth/RBAC/user-mgmt/role-builder work. 3 fixed tiers (tenant_manager/tenant_superadmin/tenant_admin) + tenant-scoped custom roles below, NEVER Billing/User-Mgmt. Rename enums via ALTER TYPE…RENAME VALUE; one owner/tenant via partial-unique index.
Rule 35  SEO Foundation (Adaptive Baseline) — always-on, no PRODUCT.md section needed. Public routes = full SEO (indexable, OG+Twitter, JSON-LD, sitemap); private/authed = noindex+disallow, fail-closed to private. Read .ai_prompt/seo.md. Phase 4 scaffold + Phase 5 gate (Lighthouse SEO ≥90 on public-facing apps); also informs the Phase 2.8/3.3 design/mockup step.
Rule 36  CI/CD Pipeline Standard — build the deploy image ONCE, promote the SAME bytes forward (dev→staging→prod; demo = retag-only). CI never auto-deploys. Staging only via data-first refresh gate; prod migration = deliberate manual step. Read .ai_prompt/cicd.md. **HARD HOLD — no staging/prod/demo deploy without the owner's explicit word; ONE carve-out (V32.59): an allowlisted Full-Auto/loop session may self-authorize a main push, STAGING ceiling only, never prod/demo.**
Rule 37  Architecture Posture — modular monolith is the DEFAULT; microservices is an owner-gated ESCALATION, never the baseline, recorded as [WHAT] in PRODUCT.md + DECISIONS_LOG. Read .ai_prompt/microservices.md. **HARD HOLD.**
Rule 38  App Audit Toolkit — tiered, Compose-native audit toolkit, MANUAL/ON-DEMAND by default — nothing auto-runs. T1 cheap (Gitleaks/Semgrep/tsc/ESLint) · T2 moderate (Trivy/OSV/Syft/BackstopJS) · T3 expensive (advisory only). Read .ai_prompt/audit.md; run scripts/audit-app.sh. **HARD HOLD.**
Rule 39  Dev-Freshness (Dev Leads Every Environment) — local dev must never serve staler code than any env you ship; rebuild app AND worker off the same main/sha as part of every ship (an app-only --build leaves the worker stale). Backstop: scripts/dev-freshness-check.sh. **HARD HOLD.**
Rule 40  Invisible-Quality Radar — ALWAYS-ON, weight-gated index keeping security/SEO/a11y/privacy/audit-ability/perf/observability/ISO/reliability/maintainability in active consideration while building. Advisory only, INHERIT-not-REPLACE over the owning rule/file. Mirrors ~/.claude/library/invisible-quality-radar.md. **HARD HOLD.**
Rule 41  Site Access & Tenancy Bootstrap — companion to Rule 34. `/tm` Tenant Management Site for the platform operator; per-tenant login routes /{slug}/login (users) and /{slug}/admin (tenant_superadmin/tenant_admin); platform permissions live in a DISTINCT vocabulary from tenant FeatureKey. Read .ai_prompt/rbac.md Parts E+F. **HARD HOLD.**
```

---

## CONTEXTUAL FILE LOADING — HOW THIS WORKS

CLAUDE.md stays compact and is the ONLY auto-loaded file. All 7 detail files live in `.ai_prompt/` — Read them on demand per task:

```
TASK YOU'RE DOING                              FILE TO READ FIRST
─────────────────────────────────────────     ──────────────────────────────────────
Bootstrap (Phase 0)                            Read .ai_prompt/bootstrap.md
Any Phase 1-8 execution                        Read .ai_prompt/phases.md → find your phase
Context thrashing / task decomposition         Read .ai_prompt/memory-governance.md
Context-budget / dispatch / anti-thrashing detail Read .ai_prompt/memory-governance.md (§1, §4) + .ai_prompt/phases.md
Writing secure code (any phase)                Read .ai_prompt/security.md
Generating UI components                       Read .ai_prompt/ui-rules.md
Working with templates (.env, compose)         Read .ai_prompt/templates.md
Following a specific scenario                  Read .ai_prompt/scenarios.md → find the number
Work-start / done-claim / failure               Read LESSONS_REGISTRY.md (Rule 32)
Writing auth / compliance / data-privacy       Read .ai_prompt/privacy.md (Rule 33 — also gov/LGU flag)
Auth / RBAC / roles / `/tm` platform site / site-access routing Read .ai_prompt/rbac.md (Rule 34 Parts A-D; Rule 41 Parts E+F)
Notifications / event-delivery / multi-channel Read .ai_prompt/notifications.md (Scenario 43)
SEO / sitemap/robots / structured data / public marketing surface Read .ai_prompt/seo.md (Rule 35)
Design pattern / state / a11y question         Read .ai_prompt/design-principles.md
Motion / timing / reduced-motion question       Read .ai_prompt/motion.md (ui-rules.md R14)
Design starter / default app-shell / theme baseline Read .ai_prompt/admincn-starter.md (HARD HOLD)
Design anti-slop check (design phases)         Run bash scripts/lint-design.sh --report-only apps/web/src
Docker/deploy phase (Komodo CI-deploy)         Read .ai_prompt/templates.md Rule 5c
CI/CD pipeline (build-once/promote, migrations, rollback) Read .ai_prompt/cicd.md (Rule 36; HARD HOLD)
Architecture posture / microservices escalation Read .ai_prompt/microservices.md (Rule 37; HARD HOLD)
Verifying mockup-vs-built layout fidelity      Run scripts/design-fidelity.mjs (Rule 31)
Refresh CLAUDE.md's live-state block           Run bash scripts/sync-context.sh
Cross-artifact gap-check (Phase 7 pre-flight)  Run bash scripts/spec-gap-check.sh --report-only
Phase 5 stage run + binding a validation record Run node scripts/run-stages.mjs --full then bash scripts/verify-record.sh write
Done-claim gate (Stop hook)                    design-stop-hook.sh runs bash scripts/verify-record.sh check --worktree
Post-deploy readiness smoke                    Run bash scripts/readiness-smoke.sh --report-only <url>
Agent/MCP detail   Read .ai_prompt/AI_Tools_Reference.md
```

**Loading rule:** Read ONLY the file matching your current task. Never load all files at once.
If a task spans multiple domains (e.g. Phase 7 Feature Update that touches UI + security),
read both relevant files. Never read scenarios.md unless the user triggers a named scenario.

---

## NON-NEGOTIABLE BEHAVIORS

- Never generate files without hydrating 9 governance docs first (Rule 4 — V32.3 Smart Hydration: Scout if >200 lines)
- Never infer — ask if not in PRODUCT.md, DECISIONS_LOG, or inputs.yml (Rule 10, 29)
- docs/PRODUCT.md is the ONLY file humans edit — agents own everything else (Rule 1)
- Every CHANGELOG_AI entry includes agent attribution (Rule 15)
- shadcn/ui is the ONLY UI component library — no MUI, Chakra, Ant Design (Read .ai_prompt/ui-rules.md)
- Loading states are DUAL-PATH (ui-rules.md Rule 11): shadcn `<Skeleton>` for shadcn-composed UI, `<phantom-ui>` wrapper for bespoke/custom UI. NEVER hand-roll a `*Skeleton.tsx` twin file.
- Every app-shell `SidebarFooter` carries a version tag `v{X.Y.Z}` + a "Developed by Powerbyte IT Solutions" new-tab link (Phase 4 Parts 5-6 GATE-CLOSURE item; Read `~/.claude/rules/design-defaults.md` Entry 3)
- Human triggers Phase 5 and Phase 6 — never auto-chain from Phase 4

### ⚠ CONTEXT BUDGET — GLOBAL PRINCIPLE (estimate scope FIRST, every session/task/phase)

You are **Claude Sonnet 4.6** — 200K token window, autocompact thrashes past ~120K input. **SAFE zone ≤80K tokens of input.** Every task you plan (Phase 4 Part, Phase 7 Feature Update, Phase 8 Batch, any unit of work) MUST fit the 80K SAFE zone — if >12 files OR >80K tokens, split by module. **OUTPUT EQUIVALENCE:** splitting into smaller sessions MUST produce the SAME final result as one large session, never a stub/placeholder/TODO.

**Architect-Execute Model — Zero Opus Execution:** Opus 4.6 plans/decomposes/reviews only, NEVER calls Edit/Write on project files (STATE.md checkpoint is the one exception). Dispatch via `Agent(subagent_type: "spec-executor")` (fallback: `Agent(model: "sonnet")` only when a task needs tools/MCPs outside spec-executor's allow-list). **500-Line Dispatch Gate:** `wc -l` every file in scope before dispatching — total ≤500 lines per Sonnet task; files >300 lines need explicit line ranges; files >200 lines need a Sonnet Scout first. Failure protocol: re-decompose (max 3 attempts) → checkpoint and defer. NEVER fall back to Opus execution.

Full anti-thrashing rules per phase, the token-budget reference table, the V32.1 Sonnet-subagent-overhead note, and the V32.2/V32.3 dispatch-discipline rules (R6 Scout-Before-Plan, R7 Parallel Fan-Out, R8 Opus Write Allow-List, R9 Dispatch Ratio Metric, Smart Governance Hydration): **Read `.ai_prompt/memory-governance.md` §1 + §4** and **`.ai_prompt/phases.md`**.

---

## 9 GOVERNANCE DOCS (hydrate before any action — Rule 4 / V32.3 Smart Hydration)

```
1  docs/memory/lessons.md           🔴 gotchas + 🟤 decisions in full; rest keyword-filtered
2  docs/PRODUCT.md                  Sections matching current task domain (Scout if >200 lines)
3  inputs.yml                       Direct read (small + structural — always full)
4  inputs.schema.json               Direct read (structural)
5  docs/CHANGELOG_AI.md             Last N + 🔴 + task-keyword hits (Scout if >200 lines)
6  docs/DECISIONS_LOG.md            Matched decisions + ALL unresolved (Scout if >200 lines)
7  docs/IMPLEMENTATION_MAP.md       Status of areas touched by task (Scout if >200 lines)
8  project.memory.md                Direct read (small + ambient)
9  docs/memory/agent-log.md         Current session + task-keyword hits from prior (Scout if >200 lines)
```

Files >200 lines route through `Agent(model: "sonnet", subagent_type: "Explore")` with the Governance Extraction Schema (`memory-governance.md §4`); files ≤200 lines are direct reads under the R6 architect-read allow-list.

---

## PHASE MENU (triggers — Read .ai_prompt/phases.md for full details)

> Every phase/part/batch/task's MANDATORY PRE-FLIGHT (phases.md) includes step 0b — confirm the planned task
> does not violate any of the 41 Rules or the L1-L6 security model before executing; [HOW] conflicts are
> resolved directly, [WHAT] conflicts are escalated to PENDING_DECISIONS.md.

```
Phase 0      Bootstrap — type "Bootstrap" in fresh project
Phase 1      Dev environment setup (OPTIONAL — skip if Node+pnpm+WSL2 ready)
Phase 2      PRODUCT.md interview — Claude Code
Phase 2.5    Spec summary — Claude Code
Phase 2.6    Design system — Claude Code (auto after 2.5 confirmed)
Phase 2.7    Spec stress-test — auto before Phase 3
Phase 2.8    Clickable mockup review — Planning Assistant session: Claude Code PA (preferred) or Claude.ai; emits docs/DESIGN.md + docs/MOCKUP.jsx as baseline
Phase 3      Generate spec files — Claude Code
Phase 3.3    Interactive Prototype & Simulation — auto after Phase 3 · client-validated prototype w/ simulated backend · design system finalizes here · gate before 3.5
Phase 3.5    Execution plan — auto after Phase 3.3 (context budget + task decomposition)
Phase 4      Full scaffold — 8 Parts, fresh session each (Rule 24)
Phase 5      Validation — human trigger: "Start Phase 5"
Phase 6      Docker + Visual QA — human trigger: "Start Phase 6"
Phase 6.5    Error triage — "First Run Error" + paste error
Phase 7      Feature Update — "Feature Update" (the daily loop)
Phase 7R     Feature Rollback — "Feature Rollback: [name]"
Phase 8      Iterative buildout — "Start Phase 8"
Resume       "Resume Session" + 3 docs
Gov Sync     "Governance Sync" + 9 docs
Retro        "Governance Retro" → weekly health report
```

---

## AGENT STACK

```
Claude Code       Primary — ALL phases. Auto-loads this file. Opus 4.6 = Architect ONLY (plan/decompose/
                  review/STATE.md checkpoint), NEVER Edit/Write on project files. Sonnet 4.6 = Executor,
                  dispatched via Agent(subagent_type: "spec-executor") (fallback Agent(model: "sonnet")).
Cline / Copilot / SpecStory   ⚠ Deprecated/retired — do not use, historical reference only.
SocratiCode       MCP — semantic codebase search. Docker required.
code-review-graph MCP — structural blast-radius. Dev machine only.
```

Full detail: Read `.ai_prompt/AI_Tools_Reference.md` §1.

---

## MCP SERVERS (6 total — 3 project-wired + 2 user-global + 1 plugin)

```
— Project-wired (.vscode/mcp.json, Bootstrap Step 10) —
socraticode       Semantic codebase search, Docker required
context7          Live library docs — prevents deprecated API usage
shadcn            Component search + install — natural language UI scaffolding

— User-global (one-time per machine, auto-available every project) —
shadcn-studio     shadcn/studio Pro DESIGN GENERATOR — /cui /iui /rui /ftc; DEFAULT design path.
iconstack         Icon SOURCING — 51k+ MIT icons/21 libs; lucide-react stays runtime baseline.

— Claude Code plugin (one-time per machine) —
code-review-graph Structural blast-radius. Install: claude plugin add tirth8205/code-review-graph.
                  Dev/Test machine only — not staging, not production.
```

Full detail: Read `.ai_prompt/AI_Tools_Reference.md` §2.

---

## FILE OWNERSHIP

```
HUMAN-OWNED:    docs/PRODUCT.md · CLAUDE.md · .vscode/mcp.json
                (EXCEPTION — CLAUDE.md's AIEF:MANAGED region, V32.20: owned by
                 scripts/sync-context.sh; never hand-edit between those markers)
AGENT-OWNED:    Everything else — src/, packages/, deploy/, inputs.yml, governance docs
NEVER COMMIT:   CREDENTIALS.md · .env.dev · .env.staging · .env.prod · .code-review-graph/
```

---

## STANDARD OUTPUT TYPES

```
SUCCESS_OUTPUT   ✅ [Phase/Task] complete. [bullets] Next: [action]
GAP_REPORT       🔴 [N] gaps found. [per-gap: SECTION, PROBLEM, FIX] NEXT STEP: [action]
HANDOFF_OUTPUT   🛑 HANDOFF [timestamp]. DOING/ERROR/ATTEMPTS/ROOT CAUSE/NEXT STEP
PROGRESS_OUTPUT  ⏳ [Phase] in progress. [current step] [% or fraction]
```

---

## CURRENT PROJECT STATE (auto-managed — do not hand-edit between the markers)

<!-- The block below is regenerated by scripts/sync-context.sh from docs/STATE.md +
     DECISIONS_LOG/PRODUCT.md + CHANGELOG_AI.md — idempotent, no-op if unchanged (V32.20). -->

<!-- AIEF:MANAGED START -->
<!-- Auto-generated by scripts/sync-context.sh — do not edit between markers. Everything else is human-owned. Source rev: unset -->

**Phase:** (run `bash scripts/sync-context.sh` to populate)
**Locked stack:** (none recorded)
**Last done:** (none recorded)
**Next:** (none recorded)
**Blockers:** (none)

**Recent CHANGELOG:**
- (no docs/CHANGELOG_AI.md entries found)

<!-- AIEF:MANAGED END -->

---

## SESSION START

When this file is loaded, respond:

```
✅ Spec-Driven Platform V32.67 loaded (compact).

Rules: 41 active. All 7 detail files on-demand in .ai_prompt/ (phases.md, memory-governance.md, security.md, ui-rules.md, bootstrap.md, scenarios.md, templates.md). privacy.md on-demand (Rule 33 — auth/compliance/gov-LGU). design-principles.md + motion.md on-demand (design/UI/motion phases when DESIGN.md/ui-rules.md silent; ui-rules.md R14 — Motion + useReducedMotion()). LESSONS_REGISTRY.md consulted at work-start/done-claim/failure (Rule 32). Only CLAUDE.md auto-loads.
Phase menu ready — type a phase name or trigger to begin.
Which phase are you starting from?
```
