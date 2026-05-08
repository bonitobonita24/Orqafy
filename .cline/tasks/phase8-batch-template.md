# Phase 8 Batch [N] Item [M] — [Module Name] [Phase] — Task File Template

> Reusable template — copy to `.cline/tasks/phase8-batch[N]-item[M].md`
> when starting a Phase 8 Batch item. Fill in every `[bracket]`.
> Each item runs in its OWN fresh Claude Code session (Rule 24).

---

## Pre-flight (MANDATORY before writing any code)

1. Read STATE.md first. Confirm `PHASE_8_BATCH_[N].item-[M-1]: ✅ merged`.
2. Read 9 governance docs (lessons.md 🔴 first, 🟤 second).
3. **Run `pnpm preflight`** — anti-thrashing gate (V31):
   ```bash
   pnpm preflight \
     --task "Phase 8 Batch [N] Item [M]: [Module] [Phase]" \
     --phase phase-8-batch \
     --read "apps/web/src/server/trpc/routers/_app.ts,apps/web/src/server/trpc/routers/[existing-router-if-extending].ts" \
     --new 3
   ```
   - **SAFE** → proceed.
   - **AT_RISK** → output the acknowledgment statement the script gives,
     then proceed with discipline (PRODUCT.md sections only, codebase_search
     over directory reads, /clear if context starts thrashing).
   - **MUST_SPLIT** → STOP. Sub-divide. Re-run preflight on each sub-task.
     Each must verdict SAFE or AT_RISK before writing any code.

4. Create branch: `git checkout -b feat/[module-slug]-[phase]`.

---

## Scope (from PRODUCT.md)

**Module:** [Module name + number]
**Phase:** [e.g. "Phase 1 — CRUD foundation"]
**Out of scope (deferred to a later batch):** [list things NOT in this item]

**Entities touched:**
- [Entity 1] — [brief role]
- [Entity 2] — [brief role]

**Procedures to implement:**
- `[router].[name]` — [one-line description]
- ...

**UI to implement:**
- `apps/web/src/app/(tenant)/[slug]/(app)/[module]/page.tsx` — [list page]
- `apps/web/src/app/(tenant)/[slug]/(app)/[module]/[id]/page.tsx` — [detail page]

---

## TDD Sequence (Rule 25)

1. Write the failing test file first:
   `apps/web/src/__tests__/[module].test.ts`. Run it. Confirm RED.
2. Implement the minimum code to make tests GREEN:
   `apps/web/src/server/trpc/routers/[module].ts`.
3. Wire the router into `apps/web/src/server/trpc/routers/_app.ts`.
4. Run `pnpm vitest run src/__tests__/[module].test.ts` — confirm GREEN.
5. Build the UI pages.
6. Run `pnpm lint --max-warnings 0` and `pnpm typecheck` — must be clean.

---

## Lessons to apply proactively

- **Banking lesson 🔴 2026-05-08:** ID inputs use `.min(1)`, NOT `.cuid()` —
  Zod `.cuid()` rejects test fixture IDs.
- **CRM lesson:** `value !== null` not `{value && ...}` for nullable string
  JSX guards (strict-boolean-expressions).
- **Vitest + Auth.js v5 🔴 2026-05-08:** NEVER import from `@/middleware`
  in a unit test — it transitively loads next-auth which fails under
  vitest's Node runner. Extract any helper to `apps/web/src/lib/<name>.ts`
  FIRST, then test against the helper.
- **Anti-thrashing 🟢 2026-05-08:** PRODUCT.md is ~40K tokens — read
  SECTIONS only. `pnpm preflight` enforces this via budget computation.

---

## Two-stage review (Rule 25, before merge)

**Stage 1 — Spec compliance:**
- [ ] Every procedure declared in this item is implemented
- [ ] Every UI element described in PRODUCT.md is rendered
- [ ] Permissions match the role table

**Stage 2 — Code quality:**
- [ ] No `any` types
- [ ] Tests written BEFORE implementation (RED→GREEN verified in commit history)
- [ ] Only blast-radius files touched (per `pnpm preflight` --read scope)
- [ ] Conventional commit message: `feat([module]): [phase] [what]`

---

## Squash-merge + governance (Rule 23)

After both stages pass:
1. `git checkout main && git merge --squash feat/[module-slug]-[phase]`
2. `git commit -m "feat([module]): Phase 8 Batch [N] Item [M] — [Module] [Phase]"`
3. `git branch -D feat/[module-slug]-[phase]`
4. **Governance writes (non-blocking):**
   - Append entry to `docs/CHANGELOG_AI.md` (Agent: CLAUDE_CODE — Rule 15 format)
   - Update `docs/IMPLEMENTATION_MAP.md` Phase Status row + add detailed section
   - Rewrite `.cline/STATE.md`: `item-[M]: ✅ merged ([commit-sha])`
   - Append to `.cline/memory/agent-log.md`
   - Add 🟢 change or 🟡 fix entry to `.cline/memory/lessons.md` if applicable
5. Output: `✅ Phase 8 Batch [N] Item [M] complete. Open phase8-batch[N]-item[M+1].md
   in a NEW Claude Code session — STOP here.`

---

## Output Contract

Before reporting complete:
- [ ] All tests GREEN (`pnpm vitest run` for the new test file)
- [ ] `pnpm lint --max-warnings 0` exit 0
- [ ] `pnpm typecheck` exit 0
- [ ] Two-stage review PASS
- [ ] Squash-merged to main, branch deleted
- [ ] CHANGELOG_AI + IMPLEMENTATION_MAP + STATE.md updated
- [ ] Final preflight verdict was SAFE or AT_RISK (acknowledged) — not MUST_SPLIT

If any check fails → fix before marking done. Do NOT merge with stale governance.
