# 🛑 Session Handoff — Orqafy — 2026-07-20 (down-sync built + merged local)

**Focus:** Orqafy (Spec-Driven tenant ERP). **Deploy posture: HARD HOLD — LOCAL only, nothing pushed.**

---

## ✅ DONE THIS SESSION
- Built **mobile down-sync (server → phone pull) for tasks + payslips** — the open item the prior
  handoff (`2cc9e0d`) flagged as "task pull-sync". Closes the two dead mobile screens (Tasks +
  Payslips WatermelonDB tables are server-origin but nothing ever populated them).
- **Squash-merged to LOCAL `main` → `aa7edfd`.** Feature branch `feat/mobile-down-sync` deleted.
  **NOT pushed.** `main` is now **30 commits ahead of origin/main**, unpushed.
- Built via superpowers brainstorm → writing-plans → subagent-driven-development (Opus PM + Sonnet
  spec-executor workers, per-task + whole-branch review). Spec + plan:
  `docs/superpowers/{specs,plans}/2026-07-20-mobile-down-sync*`.
- Gate (controller-verified vs ground truth): **web 1436/1436 · mobile 44/44 · typecheck 0 both ·
  lint clean both · schema drift EMPTY** (no prisma migration, no WatermelonDB version bump).
- `apps/mobile` gained its **FIRST test runner** (vitest, node-env, `src/sync/__tests__` only).
- Whole-branch review caught + fixed a **CRITICAL shared-handset payslip PII leak** (details below).
- Recorded: project memory `mobile_down_sync_2026-07-20.md` + MEMORY.md index; global lesson in
  `~/.claude/LESSONS_GLOBAL.md` (`mobile.offline-cache.unscoped-query-becomes-pii-leak-on-first-write`).

### What down-sync actually is (for the next session)
- **Server:** `GET /api/sync/tasks` (assigned-to-me via `TaskAssignment` join — Task has NO
  `assignedTo` scalar) + `GET /api/sync/payslips` (own-employee PII bind `employee:{userId}`,
  released payrolls only, period joined from `Payroll` — Payslip has NO period fields). Same chain
  as up-sync (`resolveSyncBearerContext` → `rateLimiters.mobile_sync` → `checkMatrixGrant`), features
  `"tasks"`/`"payroll"`, reads allowed for demo. Deterministic `orderBy` + `take:500`.
- **Mobile:** pure zero-import `sync/reconcile.ts` (decision) split from `sync/pull.ts` (single
  `database.write(()=>database.batch())` per entity — WatermelonDB forbids nested writers). Triggers:
  push-then-pull 30s tick + app-foreground + pull-to-refresh (incl. empty state).
- **Governing rule:** up-sync owns rows with pending local writes (`synced=false` skipped/never
  destroyed); server owns everything else. Full-replace, no cursor.

---

## 🔓 PENDING DECISIONS — owner-gated `[WHAT]` (all HARD HOLD, nothing done without explicit word)

1. **Push feature-program + down-sync to STAGING.** `main` is 30 commits ahead of origin/main
   (compression + mobile-native + sync + down-sync). "push to staging" = FF+push `main` → CI →
   staging stack. Staging is currently live on the OLDER `v0.11.0-rc.1` image — these 30 are not on it.
2. **Production promotion (M7).** First-time prod stand-up on the VPS (irreversible). Separate
   explicit word, only after staging verified green.
3. **RBAC 3-tier promotion.** Dev-local only; naming `tenant_super_admin` → `tenant_superadmin` fixed
   dev-local (unpushed, `6a9ec94` per prior memory). Promotion to staging/prod owner-gated.
4. **Rebuild the dev Docker container** off latest `main` — I did NOT do this (not asked). Say the
   word if you want dev to reflect the down-sync build in Docker (Tier-1, ~1–3 min).
5. **SEO retrofit (framework V32.30/31, Scenario 44)** — surfaced in `docs/SUGGESTED_NEXT_TASK.md`.
   Deferred, additive, owner-gated adoption. Not started.

---

## ⚠️ UNCOMMITTED WORKING-TREE STATE (NOT my work — decide before any push)
The tree has **framework V32.31 + SEO changes that arrived mid-session** (linter/deploy edits),
which I deliberately kept OUT of the down-sync branch and did NOT commit:
```
 M .ai_prompt/{CLAUDE_compact,Framework_Feature_Index,LESSONS_REGISTRY,Master_Prompt,
    Planning_Assistant,phases,scenarios,templates,ui-rules}.md
 M AI/Master_Prompt.md   M CLAUDE.md   M deploy.sh
 ?? .ai_prompt/seo.md    ?? docs/SUGGESTED_NEXT_TASK.md
```
These are a framework-governance sync (V32.31), separate from the down-sync feature. Decide whether
to commit them as their own governance commit or discard — do NOT fold them into a feature push.

---

## 🧾 FOLLOW-UP TICKETS from down-sync review (non-blocking, separate tickets)
- Telemetry counter on the reset-seeding-failure branch (`sync/reset-on-login.ts`) to confirm the
  legacy-install migration window closes in the field.
- The **3 pre-existing `/api/sync` routes** ([entityType], expenses/receipt, expense-categories)
  share the older *partial* try/catch error-containment gap; only the 2 new GET routes were hardened.
- **No session guard on `apps/mobile/src/app/(app)/_layout.tsx`** — a deep link (`orqafy://`) into a
  screen post-logout could render stale rows before redirect. The new per-user filters mitigate but
  don't fully close it.
- Validators in `sync/reconcile.ts` are boolean predicates, not TS type predicates → the internal
  `as T[]` stays an unchecked cast (runtime sound, typing loose).
- Consider dropping the `tokenUserId` fallback + clearSession seeding one release after full fleet
  adoption of `USER_ID_KEY`.

---

## 🔴 THE CRITICAL (why it matters going forward)
Payslip PII leaked across users on a shared handset: `logout()` cleared only SecureStore tokens,
never the local DB, and both screens queried with no user filter. Harmless for months **because the
payslips table was always empty** — this branch is the FIRST code that ever writes payslip rows
locally, which instantly turned a dormant no-op guard into a live IDOR. Fixed via login-time DB reset
on user-identity change + per-user screen filters + identity-seed at `clearSession()` (before the
token is deleted, best-effort, never blocking session clear). Generalized lesson logged globally.

---

## NEXT SESSION — start here
1. Confirm `main` @ `aa7edfd`, 30 ahead of origin/main, unpushed. Tree still dirty with the V32.31
   framework files (item ⚠ above).
2. Await owner word on the gated queue (staging push / prod / RBAC promotion / dev rebuild / SEO).
3. If continuing dev: the DTR + expenses down-sync (deferred) is the natural next feature slice;
   or pick up any follow-up ticket above.
Nothing is running. Nothing is deployed. HARD HOLD holds.
