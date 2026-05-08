# Pause Handoff — Phase 8 Batch 1 Item 3 TDD Foothold

**Date:** 2026-05-08
**Branch:** `feat/landing-demo-entry`
**HEAD commit (before pause-stamp commit):** `a6755c5`
**Status:** PAUSED. Branch open, NOT squash-merged.

---

## What Triggered This Session

User invoked `/clear` and asked: *"retry the last tasks because you are
stuck in thrashing"* — referring to a previous Claude Code session that
had failed.

## Root Cause of the Previous Thrashing (diagnosed from SpecStory)

`.specstory/history/2026-05-07_16-43-50Z-resume-session-read-state.md`
line 9638:

> *"Autocompact is thrashing: the context refilled to the limit within
> 3 turns of the previous compact, 3 times in a row. A file being read
> or a tool output is likely too large for the context window. Try
> reading in smaller chunks, or use /clear to start fresh."*

The previous session had successfully written the RED test file
(`apps/web/src/__tests__/landing-demo.test.ts`, 8 tests, 173 lines)
and verified RED. It then thrashed trying to make the middleware test
pass. The test imported `isPublic` from `@/middleware`. `middleware.ts`
has `export default auth(function middleware(req)...)` at module top —
that `auth()` call fires at import time, loads `next-auth`, and
next-auth fails to resolve `next/server` under vitest's Node runner:

```
Cannot find module '.../next/server' imported from
.../next-auth/lib/env.js
Did you mean to import "next/server.js"?
```

No vitest config tweak or `vi.mock()` on next-auth fixes it cleanly
because the failing import is transitive via env.js. Chasing the right
mock setup is what blew context — repeated re-reads of large governance
files (PRODUCT.md, IMPLEMENTATION_MAP) on each retry pushed past the
autocompact threshold.

## What This Session Delivered (committed in `a6755c5`)

Tight scope: get the existing 8-test landing-demo.test.ts from RED to
GREEN as a **discrete committable foothold**, deferring all UI work
to a fresh-context session.

### Structural fix (instead of mock chasing)

**Extract the pure helper, don't mock the side effect.**

- **NEW** `apps/web/src/lib/public-paths.ts` — `PUBLIC_PATHS` array
  + `isPublic(pathname)` helper. Pure module, zero auth deps. Loads
  cleanly under vitest because nothing transitively imports
  `next-auth` or `next/server`. `PUBLIC_PATHS` now includes `/`
  and `/demo-login` (new entries for landing + demo entry).

- **MODIFIED** `apps/web/src/middleware.ts` — imports `isPublic` from
  the helper and re-exports it for back-compat. `PUBLIC_PATHS` array
  removed (now lives in helper). Auth/redirect logic unchanged.

- **MODIFIED** `apps/web/src/__tests__/landing-demo.test.ts` — import
  path updated from `@/middleware` to `@/lib/public-paths`. Removed
  unused `publicProcedure` import (lint).

### tRPC plumbing for landing page

- **NEW** `apps/web/src/server/trpc/routers/plan.ts` — `planRouter`
  with `listActive` public query: `prisma.plan.findMany({ where:
  { isActive: true }, orderBy: { sortOrder: "asc" } })` returning
  `{ plans }`. Public (no auth) — landing page can call it.

- **MODIFIED** `apps/web/src/server/trpc/routers/_app.ts` — wire
  `planRouter` as `plan` on `appRouter`.

### Verification

- `pnpm vitest run src/__tests__/landing-demo.test.ts` — **8/8 GREEN**
  - 3× plan.listActive (sorted, unauth, empty)
  - 2× writeProcedure demo blocking (FORBIDDEN on demo, allow regular)
  - 3× isPublic public-path matching (`/`, `/demo-login`, `/dashboard`)
- `pnpm typecheck` — **clean**
- `pnpm lint --max-warnings 0` — **clean**
- Two-stage review (Rule 25) — **PASS** (spec compliance + code quality)

### Governance writes

- `docs/CHANGELOG_AI.md` — full Item 3 foothold entry (Agent: CLAUDE_CODE)
- `.cline/memory/lessons.md` — 🔴 gotcha entry "Vitest + Auth.js v5:
  never import middleware.ts from a unit test" with the full root cause
  and the structural-fix rule (extract first, then test against helper)
- `.cline/STATE.md` — rewritten with `Phase 8 Batch 1 Item 3 PARTIAL`
- `.cline/memory/agent-log.md` — append-only entry for this session

### Plugin recommendations explicitly skipped (with reason)

- `proxy.ts` migration — Next.js pinned at **15.5.15**, not 16.
  middleware.ts is the correct filename for this version.
- `next-forge` patterns — project follows **Spec-Driven Platform V31**,
  not the next-forge starter template.
- `nextjs` / `auth` / `routing-middleware` skill loads — minimal
  change to verified Phase 6 middleware. No auth flow change. Out of
  scope of "retry the thrashed task." CLAUDE.md H1 priority: rules
  (level 2) > plugin suggestions (level 7).

---

## What Is NOT Done (the rest of Item 3)

These are the deliverables for the **next** Claude Code session that
resumes on `feat/landing-demo-entry`:

1. **Root landing page** — `apps/web/src/app/page.tsx`. Currently no
   root page exists; middleware redirects `/` to `/login`. Needs to
   render hero + pricing tiers (call `plan.listActive` — already
   wired) + CTA buttons to `/register` and `/demo-login`. Honor
   `docs/DESIGN.md` (VoltAgent palette: `#050507` + `#00d992`).

2. **Registration page** — `apps/web/src/app/register/page.tsx`.
   Form with tenant name + slug + admin email + admin password +
   plan select. Calls `registration.validateSlug` (debounced) and
   `registration.createTenant` (Item 2 deliverables — already exist
   on main, no scaffold needed).

3. **Demo entry page** — `apps/web/src/app/demo-login/page.tsx`.
   One-click button that signs the user in as a demo-tenant user
   (PRODUCT.md spec: demo tenant is read-only — `writeProcedure`
   already FORBIDS mutations there, verified by tests).

4. **Platform admin pages** — `apps/web/src/app/powerbyte-admin/`
   route group:
   - `layout.tsx` with platform-admin guard (server-side check
     against `Platform Owner` role) OR extend middleware urlSlug
     logic with a `powerbyte-admin` fast-path. **Decide which
     and lock in DECISIONS_LOG.md before writing code.**
   - `page.tsx` — list tenants (`platform.listTenants`)
   - `[tenantId]/page.tsx` — tenant detail with suspend/reactivate
     buttons (`platform.suspendTenant`, `platform.reactivateTenant`)

5. **Middleware update** — add `/register` to `PUBLIC_PATHS` in
   `apps/web/src/lib/public-paths.ts`. (`/demo-login` and `/`
   already added in this session.)

6. **Visual QA** (Rule 16) — load each new page in a browser, verify
   no console errors, no security-header regressions, all pages
   render with the VoltAgent design tokens. Browser-interactive QA
   is currently gated on system Chrome install (MCP Playwright
   requires `/opt/google/chrome/chrome`). HTTP-level QA workaround
   from Phase 6 is acceptable if Chrome still unavailable.

7. **Two-stage review** on the full feature (not just the foothold).

8. **Squash-merge** `feat/landing-demo-entry` → `main` → delete branch.

9. **Governance writes after merge**:
   - Append Item 3 completion entry to `docs/CHANGELOG_AI.md`
   - Rewrite `docs/IMPLEMENTATION_MAP.md` Module 1 + Module 2 +
     Module 17 status rows + Phase 8 Batch 1 row
   - Rewrite `.cline/STATE.md` — `PHASE_8_BATCH_1.item-3: ✅ merged`
   - Append `.cline/memory/agent-log.md` entry for the merge

---

## Repo State at Pause

```
Branch:          feat/landing-demo-entry
Commits ahead:   1 (a6755c5 — TDD foothold) + this pause-stamp commit
Working tree:    clean after pause-stamp commit lands
Untracked .bak:  4 files from 2026-05-08 framework lift (unrelated;
                 leave alone — separate concern from Item 3)
```

The 4 untracked `.bak` files are:
- `.claude/rules/phases.md.20260508_003746.bak`
- `.claude/rules/templates.md.20260508_003746.bak`
- `AI/Master_Prompt_v31.md.20260508_003746.bak`
- `CLAUDE.md.20260508_003746.bak`

These appear to be from a separate framework-lift session. **Do not
touch them in the resume — they belong to a different work stream.**

---

## Resume Instructions

1. Open a NEW Claude Code session (fresh context — important).
2. Verify branch with `git branch --show-current` →
   `feat/landing-demo-entry`. If on `main`, run
   `git checkout feat/landing-demo-entry`.
3. Verify foothold tests still pass:
   `cd apps/web && pnpm vitest run src/__tests__/landing-demo.test.ts`
   → expect 8/8 GREEN.
4. Read this handoff. Read `STATE.md` (PAUSED → resume).
5. Run "Resume Session" with 3 docs (`project.memory.md`,
   `IMPLEMENTATION_MAP.md`, `DECISIONS_LOG.md`) per Rule 24, OR jump
   directly to "Continue Phase 8 Batch 1 Item 3 from foothold."
6. Decide the platform-admin guard pattern (middleware fast-path vs
   server-side layout check). Lock in `DECISIONS_LOG.md`. **Ask
   before coding** — don't infer (Rule 29).
7. Write each new UI page TDD-style (RED test → GREEN impl) per
   Rule 25. Remember: **never import `@/middleware` from a unit
   test** — extract any helper to `apps/web/src/lib/<name>.ts`
   first (🔴 gotcha 2026-05-08).
8. After all UI pages green: two-stage review on full feature.
9. Squash-merge to main. Delete branch. Governance writes.
10. After Item 3 merges: Phase 8 adaptive replanning (V14) — assess
    remaining roadmap before proposing batch 2.

---

## Pre-flight Checks for Resume

Before writing any code in the next session:

- [ ] STATE.md reads `Phase 8 Batch 1 Item 3 PARTIAL` and matches the
      branch name. If mismatch — investigate before continuing
      (Rule 24 fresh-start safety).
- [ ] `git log feat/landing-demo-entry..main` should be empty (main
      has not advanced).
- [ ] `apps/web/src/lib/public-paths.ts` exists, `apps/web/src/server/
      trpc/routers/plan.ts` exists. If missing, foothold is corrupt —
      check this commit's existence (`a6755c5`) and reset if needed.
- [ ] No CREDENTIALS.md changes since last verify (Phase 6 already
      passed — should be stable).
- [ ] Docker dev stack is up if running browser QA: `docker ps |
      grep orqafy_dev` should show 7 healthy containers.

---

## No New Decisions This Session

`DECISIONS_LOG.md` not updated — no new architectural decisions made.
The structural choice to extract `PUBLIC_PATHS` + `isPublic` is a
tactical fix, fully captured in lessons.md as a 🔴 gotcha. The
remaining Item 3 architecture decisions (platform-admin guard
pattern, demo-tenant impersonation flow) are deferred to the
resume session — the user should be asked before they get locked.

## Files Changed This Session

```
NEW:
  apps/web/src/server/trpc/routers/plan.ts
  apps/web/src/lib/public-paths.ts
  apps/web/src/__tests__/landing-demo.test.ts
  .cline/handoffs/2026-05-08-pause-item3-tdd-foothold.md  ← this file

MODIFIED:
  apps/web/src/middleware.ts
  apps/web/src/server/trpc/routers/_app.ts
  .cline/STATE.md
  .cline/memory/agent-log.md
  .cline/memory/lessons.md
  docs/CHANGELOG_AI.md
  docs/IMPLEMENTATION_MAP.md  ← updated in this pause
```

No schema changes. No new dependencies. No env changes.
