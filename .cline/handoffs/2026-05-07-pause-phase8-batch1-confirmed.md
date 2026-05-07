# Handoff — Phase 8 Batch 1 Confirmed (Paused)
# Written: 2026-05-07 by CLAUDE_CODE
# Type: PAUSE (user confirmed batch, requested rest before execution)

## Current Progress

Phase 8 has been triggered. The agent read all 9 governance docs, generated
the next-build-batch proposal (3 items), and the user replied "confirmed".
**No code has been written yet.** Execution starts at the next session.

## Confirmed Batch 1 — execute in this exact order

Each item is its own Phase 7 cycle:
  1. Read 9 governance docs (auto)
  2. Branch `feat/<slug>` (Rule 23)
  3. Blast-radius check via codebase_search (Rule 17)
  4. Failing test FIRST (Rule 25 TDD — RED)
  5. Implement minimal code to pass (GREEN)
  6. Two-stage review: spec compliance + code quality (Rule 25)
  7. Squash-merge → delete branch → rewrite STATE.md
  8. Append CHANGELOG_AI.md / lessons.md / IMPLEMENTATION_MAP.md
  9. STOP. Open new session for next batch item.

### Item 1 — `apps/worker` scaffold + tenant-provisioning queue end-to-end
- **Branch:** `feat/worker-tenant-provisioning`
- **Why first:** Unblocks all 23 declared queues. Without a running worker
  process, `packages/jobs` queue factories produce nothing. Tenant
  provisioning is the first job that *must* work — it creates the per-tenant
  Postgres schema and runs tenant-scoped seed.
- **Scope:**
  - New `apps/worker/` Node app (BullMQ runtime, graceful shutdown, DLQ logger)
  - Wires up `tenant-provisioning` queue from `packages/jobs`
  - Worker invokes `packages/db` schema-provisioning helper
    (`createTenantSchema(slug)` already exists per Part 3) + tenant-scoped seed
  - Health endpoint or Komodo healthcheck
  - Compose entry in `deploy/compose/{dev,stage,prod}/docker-compose.app.yml`
    (or split into `docker-compose.worker.yml`)
  - Reuses `packages/jobs` `BaseJobData` with `tenantId` (already typed)
- **Tests (RED first):** Job consumer test that enqueues a fake tenant
  payload and asserts schema exists + seed rows present after worker
  processes it.

### Item 2 — Module 17 (platform-admin) + tenant onboarding flow
- **Branch:** `feat/platform-admin-tenant-onboarding`
- **Depends on:** Item 1 (worker must run for provisioning to complete)
- **Scope:**
  - `apps/web/src/app/(platform)/platform/` route group
    (webmaster-only, RBAC guard `platform_owner`)
  - Tenant list page: rows from `Tenant` global-schema table
    (already in seed)
  - Create-tenant form: slug, name, plan picker (5 plans seeded),
    primary admin email
  - On submit: enqueue `tenant-provisioning` job via tRPC mutation
  - Tenant detail: subscription state, suspend/reactivate, view AuditLog
  - Plan management: list 5 seeded plans (Free, Starter, Pro,
    Business, Enterprise per IMPLEMENTATION_MAP)
- **Tests:** Webmaster can create tenant → poll status → see active
  → log in as that tenant's first admin → land on empty dashboard.

### Item 3 — Module 1 (public-landing) + Module 2 entry (demo-system signup)
- **Branch:** `feat/landing-demo-entry`
- **Depends on:** Item 2 (so the "Sign up" CTA actually wires somewhere)
- **Scope:**
  - Replace `/` 307→/login with marketing landing page
    (hero, features, pricing pulled from `Plan` seed table, CTAs)
  - VoltAgent aesthetic per `docs/DESIGN.md` (dark, Signal Green accent)
  - "Try the demo" CTA → `/demo-login` route that signs visitor in as
    seeded demo tenant with `isDemoTenant: true` JWT claim
    (mutation-block middleware already exists per Phase 2 decision #5;
    just needs the entry)
  - "Sign up" CTA → tenant signup flow from item 2
- **Tests:** Anonymous visitor lands on `/`, sees pricing, clicks demo,
  ends up in dashboard as demo user, attempts a mutation, receives
  block response.

## Pre-flight checks (run before starting Item 1)

- [ ] `docker ps | grep orqafy_dev` — verify 7 containers still healthy
      (if down: `bash deploy/compose/start.sh dev up -d`)
- [ ] `git status` — confirm clean (was clean at this pause)
- [ ] `pnpm tools:check-product-sync` — confirm exit 0 (was passing)
- [ ] `cat .cline/STATE.md` — confirm PHASE = "Phase 8 batch 1 confirmed"
- [ ] (Optional) System Chrome install for browser-QA on item 2/3 —
      if not done, will defer browser QA and rely on HTTP-level QA per
      same workaround used in Phase 6

## Files Modified This Session

- `.cline/STATE.md` — PHASE updated to "Phase 8 batch 1 confirmed (PAUSED)"
- `.cline/handoffs/2026-05-07-pause-phase8-batch1-confirmed.md` — this file
- `.cline/memory/agent-log.md` — Phase 8 proposal + confirmation entry
- `docs/CHANGELOG_AI.md` — Phase 8 batch confirmation entry

No source files touched. No new dependencies. No schema changes.

## Resume Instructions

1. Open a NEW Claude Code session
2. Confirm STATE.md still shows "Phase 8 batch 1 confirmed (PAUSED)"
3. Say **"Start batch 1 item 1"** OR **"Resume Phase 8 batch 1"**
4. Agent will:
   - Re-read 9 governance docs + this handoff
   - Run pre-flight checks above
   - Create `feat/worker-tenant-provisioning` branch
   - Begin Item 1 (worker scaffold) following Phase 7 cycle
5. After Item 1 squash-merges to main: STOP, open new session for Item 2
6. After Item 2 squash-merges: STOP, open new session for Item 3
7. After Item 3: Phase 8 returns to roadmap-check + propose next batch
   (per Phase 8 adaptive replanning — V14)

## Branch State

Currently on `main`, clean tree (was clean before this pause; only the
4 governance file edits added in this pause — uncommitted by design,
they ARE the resume signal).

No feature branches exist. Item 1 will create `feat/worker-tenant-provisioning`.

## Notes

- User explicitly accepted batch ordering as proposed — do not reorder
  without re-asking.
- User did NOT request a feature module (CRM, accounting, payroll) in
  batch 1 despite being offered — they want SaaS foundation first.
- After batch 1 completes, the demo + signup flow is shippable as a
  marketing-only landing site even before any business module exists.

---

## Session Pause Stamp (2026-05-07, end of session)

User requested formal session pause after batch confirmation. All governance
artifacts written and committed to `main` per V31 pause protocol:
- STATE.md ✅ marked PAUSED
- IMPLEMENTATION_MAP.md ✅ Phase 8 row → 🔵 Batch 1 confirmed
- CHANGELOG_AI.md ✅ Phase 8 confirmation entry written
- agent-log.md ✅ Phase 8 trigger + confirmation entry
- DECISIONS_LOG.md — no new decisions this session (no edit)
- lessons.md — no errors resolved this session (no edit)

No feature branch exists yet (Item 1 will create it). No squash-merge.
Commit lands directly on `main` with `wip: pause session — Phase 8 batch 1
confirmed, no code yet`.
