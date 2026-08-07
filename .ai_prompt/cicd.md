# CI/CD Standard — on-demand reference (V32.32, deliverable #32)

> **Load this file at Phase 6 (Docker/deploy) and whenever a CI/CD Scenario fires** — pipeline
> setup, staging validation, production promotion, demo push, or rollback. This is the **umbrella**
> standard for every locked-stack (Next.js · tRPC · Prisma · PostgreSQL · Docker Compose · Komodo ·
> Traefik) tenant-SaaS app the framework scaffolds. It **ties together and extends** two narrower
> on-demand references without restating them: the 3-tier natural-language deploy contract
> (`~/.claude/rules/deploy-discipline.md`) and the staging data-first validation gate
> (`~/.claude/rules/staging-refresh-gate.md` + the `staging-gate/` generator). Where those two own
> the executable detail, THIS file is the whole-pipeline map + the pieces they don't cover: image
> promotion, production migration ordering, demo self-heal, and coupled rollback.
>
> **INHERIT-not-REPLACE:** where a project's `deploy/` scripts or `docs/` already define a concrete
> promotion procedure, that wins. This file is the standard *pattern* that fills silence at scaffold
> time — it never overrides an app's deliberate deviation.

This is the fleet-standard answer to "how does an app move from local dev → staging → production →
demo, and what happens to its database at each step." Reference implementation: **Marine-Guardian**
(`deploy/` + `.github/workflows/`). Companion: `templates.md` (compose/env file templates this
generates from), `security.md` (secrets handling), `rbac.md`/`notifications.md`/`seo.md` (other
on-demand deliverables this pairs with at scaffold time).

**Scope note.** This standard is for the Docker/Komodo/Traefik/Postgres/Prisma locked-stack apps —
every framework-built app. It does not apply to a WordPress, PHP, or static/Vercel-hosted project;
those are "N/A, different stack" and out of scope here.

---

## 0. Core principle — build once, promote the bytes, vary only the data rules

**Build the image ONCE, promote the SAME bytes forward through every tier, and let each
environment's DATA rules differ** — dev is disposable, staging rehearses on a fresh production
copy, production is never wiped, demo is never reseeded. Every mechanic below exists to serve this
one line; if a generated script ever rebuilds an image between tiers, or wipes/reseeds production,
it has broken the standard.

---

## 1. The two GitHub workflows (split, on every push to `main`)

1. **`ci.yml` — gates the merge, nothing else.** Governance (validate-inputs · check-env ·
   check-product-sync) → quality matrix (`lint · typecheck · test · build` via Turbo, Prisma Client
   generated first) → security (`pnpm audit --audit-level=high`). All jobs must pass to merge.
2. **`docker-publish.yml` — builds & publishes ONLY.** Triggers on `main` (docs/`*.md` paths
   ignored) + `workflow_dispatch`. Builds the app image, tags `latest` + `staging-latest` +
   `sha-<short>`, pushes to the registry — **then STOPS.** CI **never** deploys an environment.
   Staging auto-deploy is deliberately absent: auto-deploying would skip the prod-data refresh and
   defeat the rehearsal that makes staging worth having.

## 2. Image-tag promotion — re-tag forward, never rebuild between tiers

`dev-latest → staging-latest → latest`, with `demo-latest` a registry retag from a chosen source tag
(usually `latest`) — never its own build. `push.sh [dev|staging|prod]` does the lockstep promotion:
**dev builds + runs tests before push; staging/prod are pure registry re-tags.** Every tier also
carries an immutable `sha-<short>` for precise rollback targeting. `start.sh [dev|stage|prod]` brings
a stack up (DB first, so the network exists before the app attaches; dev builds from source,
stage/prod pull the registry image), everything namespaced by `${COMPOSE_PROJECT_NAME}` so
parallel stacks on one host never collide.

## 3. The four environments & their DATABASE treatment (the heart of the model)

| Env | Data it holds | On each deploy | Migrations | Reseed |
|---|---|---|---|---|
| **Local dev** | Dummy / synthetic seed | Freely reset / rebuilt from source | `migrate:dev`, freely | Yes |
| **Staging** | A **fresh copy of PRODUCTION**, refreshed every run | Backed up, then wiped & reloaded from a prod dump | `migrate deploy` + drift-resolve | No (inherits prod rows) |
| **Production** | Real official data | **Never wiped**; migrated in place | `migrate deploy` — manual, rehearsed on staging first, never auto-on-boot | **NEVER** |
| **Demo** | Curated showcase data | Backed up, then preserved | `migrate deploy` + drift-resolve | **NEVER** |

**Key invariant:** production **schema** is updated whenever dev has real migrations (they flow
dev → image → staging rehearsal → prod), but production **data** is never wiped, reloaded, or
reseeded — migrations run in place and touch only what each migration explicitly changes.

## 4. Staging data-first gate — POINTER only (full detail: `staging-refresh-gate.md`)

Staging refreshes its DB from a prod copy **before** the candidate image + migrations are applied,
so the same image that goes green on staging is rehearsed against real prod-shaped data. **Do not
restate the 6-step procedure or its 4 robustness invariants here** — they live in
`~/.claude/rules/staging-refresh-gate.md` and are materialized per app by the
**`staging-gate/`** generator (`staging-refresh-setup`), never hand-ported. Green on staging ⇒ the
identical image is safe to promote to production.

## 5. Production promotion — the 8-step manual sequence (never automatic)

Production promotion is a deliberate manual act; an image swap does not migrate on its own, and the
app does not migrate on boot.

1. **Backup prod** (the rollback point).
2. **Pin the tag + pull** the promoted image.
3. **STOP the app + worker** — remove the stale writer before anything touches the schema.
4. **`migrate deploy`** — this is where dev's schema changes actually apply to prod.
5. **`migrate status` HARD GATE** — abort, do not proceed to step 6, if the schema is not clean.
6. **Verify pairing** (image tag ↔ schema version match what was rehearsed on staging).
7. **Bring the app up** on the new image.
8. **Verify** (health check + a real smoke path, not just a 200).

**Ordering rule that matters: stop → migrate → gate → up.** New code must never run against an
un-migrated schema; old code must never keep writing mid-migration. `migrate deploy` applies only
*pending* migrations — a no-op run is always safe to re-invoke.

## 6. Demo — deliberate-push env, migrate YES / reseed NEVER — plus SELF-HEAL

Demo push: backup demo DB → retag source → `demo-latest` → `migrate deploy` + drift-resolve →
**never reseed** → verify. Curated demo rows are the product being shown to a client; they are
sacred.

**Demo self-heal.** An infra-level **`demo-reset.sh`** (host cron / Komodo scheduled action —
**not** an in-app job, so it still runs if the app itself is broken) auto-resets a messed-up demo on
a fixed interval:
1. Check a **pause flag** (skip the reset before a scheduled client demo).
2. Back up the current state first.
3. Restore a **blessed GOLDEN snapshot — DB + media** (media backend per
   `~/.claude/rules/media-storage-default.md` — MinIO on demo).
4. `migrate deploy` + drift-resolve (an older golden snapshot may land on a newer schema) —
   **never reseed**.
5. Health-check, demo stack only.

Restore always comes from a deliberately-**blessed golden baseline** (a separate "bless as golden"
action captures a new one on purpose) — **never** the rolling operational backup, which could
faithfully restore an already-broken state.

## 7. Rollback — MUST couple image + schema

An image-only rollback (re-tag the previous `sha` + bring it up) while leaving the newer schema in
place is a footgun: old code running on new schema. The generated **`rollback.sh`** must EITHER:
1. Couple both — re-tag the previous `sha` **and** restore the paired pre-promotion database dump,
   behind an explicit "⚠ this discards data written since promotion — confirm" prompt; **or**
2. At minimum, guardrail the mismatch — refuse / loudly warn when rolling the image back while
   `migrate status` shows the schema has advanced past that image.

**Standing preference: fix forward**, not rollback (a schema rollback is data loss for every row
written since promotion). The pre-promotion backup from Production Promotion step 1 is what makes a
true rollback possible at all; a mismatched old worker must fail loudly (a CHECK constraint, a
version-pairing assertion), never corrupt data silently.

## 8. Komodo + Traefik

Stacks live as files-on-host under `/etc/komodo/stacks/<slug>` and are **registered Komodo Stack
resources** — each environment (`<app>-staging` · `<app>` for prod · `<app>-demo`) is a Stack that
Komodo *tracks*, not a container hand-installed on the server. Promotion drives that stack via **SSH +
`docker compose -p ${COMPOSE_PROJECT_NAME}`** against the file-on-host stack (the proven path the
generated `push.sh` / `start.sh` / `rollback.sh` use); Komodo's **`DeployStack` / `ResourceSync` API**
is used for stack **registration and verification** (§8.1) — NOT to replace the compose promotion.
Traefik labels apply ONLY to the app service (`websecure` entrypoint · `letsencrypt` certresolver ·
host-routed); databases and other side services stay internal-only (private network, no host ports).

**Domain/subdomain pattern (declared once at scaffold).** `<app>.<domain>` = production ·
`staging.<app>.<domain>` (stack `<app>-staging`) = staging · `<app>-demo.<domain>` (stack
`<app>-demo`) = the client demo; local dev is host-only (no public domain). The generator takes these
as `--prod-domain` / `--staging-domain` / `--demo-domain` and fails loudly rather than guessing.

## 8.1 Stack Registration Audit — every environment is a Komodo-tracked Stack (Production first)

A stack directory existing on the host does NOT mean Komodo tracks it. A production installed directly
on the server is invisible to Komodo's stack list, cannot be promoted or rolled back through this
pipeline, and drifts silently — the exact failure mode this audit exists to catch. The generator emits
**`deploy/komodo-verify.sh`** (also reachable as `cicd-gen --audit`):

1. For each env stack — **Production first and loudest** — confirm it is Komodo-tracked via
   `km list stacks` (CLI; alias `km ls stacks`) or the `ListStacks` / `GetStack` read API
   (`KOMODO_HOST` + `KOMODO_API_KEY` + `KOMODO_API_SECRET`).
2. An on-host stack directory (`/etc/komodo/stacks/<slug>`) that is **absent from Komodo's list** is a
   finding — **scripted-register it** by emitting/syncing a **ResourceSync `[[stack]]` TOML stanza**
   (`name` · `config.server` · `config.file_paths` · git `repo`/`account`) that Komodo syncs from git;
   the manual **Komodo-UI procedure (Scenario 32 Part C)** is the fallback only when the CLI/API is
   unavailable.
3. **Fail-open on tooling** (no `km`/API creds → warn "cannot verify", exit 0 — same graceful-degrade
   posture as `lint-deploy.sh` / `dev-freshness-check.sh`); **fail-closed on a real untracked-prod
   finding** (exit non-zero) so a hand-installed prod cannot pass unnoticed.

Run advisory/report-only at Phase 6 after the pipeline is generated (a backstop, never a hard blocker)
and on the Scenario 45 retrofit. **Production stays a MANUAL-trigger promotion** — registration makes
prod visible to and promotable through Komodo, but it is never auto-deployed by a merge to `main`.

**Deploy-platform seam.** The audit expresses three verbs — **register-stack · deploy-stack ·
verify-stack** — against Komodo today; a future non-Komodo platform implements the same three verbs
without touching the compose promotion scripts.

## 9. Secrets

Runtime config lives in per-stack `.env.<env>` on the host (gitignored); canonical secrets are
SOPS-encrypted in **Server-Setups** (`<Server>/secrets/*.enc.yaml`); CI reads GitHub Actions secrets
(`DOCKERHUB_*`, `KOMODO_*`, …). Scripts read live values off the host `.env` at deploy time — never
from a stopped container (a step needing app env while the container is stopped reads the stack
`.env` file instead). Never paste a secret into an app repo or a free/public LLM tier.

**Per-environment credentials.** Each environment (dev · staging · prod · demo) gets its own securely
generated credential set — DB passwords, service tokens, and the per-env seeded login/RBAC accounts —
stored ONLY in the Server-Setups SOPS vault, never in the app repo, and **never cross-seeded** between
the real (dev/staging/prod) and demo tiers. This is the same authorization the framework already
carries for generating per-env access; the Komodo Stack for each env reads its own `.env.<env>` at
deploy time. (Login/RBAC per-env seeded creds: the universal-login vault entry in Server-Setups.)

---

## 10. What the scaffold emits (Phase 6)

Generated per app by the repo-root **`cicd-gen/`** generator — never hand-ported; the
staging-refresh step is delegated to **`staging-gate/`**. The generator materializes:
`ci.yml` · `docker-publish.yml` · `push.sh` · `start.sh` · `staging-refresh-and-deploy.sh`
(via `staging-gate/`) · `push-to-demo.sh` · `rollback.sh` · `demo-reset.sh` · **`komodo-verify.sh`**
(the §8.1 Stack Registration Audit). It fails loudly on a missing required token rather than guessing
a value (host/IP, compose project name, DB workspace package, health path, per-env domains — all
discovered, never fabricated).

## 11. Retrofit / adoption on an existing app (owner-gated)

Follow the framework's **CI/CD Scenario**: dev-first, LOCAL-only. Sync the app to the current
framework version, then run `cicd-gen/` against the existing repo layout; where an app already has a
`deploy/` directory, reconcile rather than overwrite. Each adopting app also carries a `docs/`
pointer note ("CI/CD follows `specdrivenprompt/cicd.md` — see `deploy/`") so a future session finds
the standard without re-deriving it. Staging/production/demo wiring or promotion on a **LIVE** app
is per-app and **owner-gated** — local commits only until the owner explicitly authorizes a push.

---

## Hard rules (never violated)

- **HARD HOLD.** Generating the pipeline templates/scripts for an app is LOCAL only. Actually wiring
  or deploying any of it on a live app is per-app, owner-gated — no staging/prod/demo push without
  the owner's explicit word (`~/.claude/rules/deploy-discipline.md`).
- **CI never auto-deploys** an environment; staging deploys only via the data-first gate
  (`~/.claude/rules/staging-refresh-gate.md`); production and demo are deliberate manual promotions.
- **Production is only ever READ** by the staging refresh (`pg_dump`, never written); production
  data is never wiped, reloaded, or reseeded — only migrated in place.
- **Every non-dev environment is a REGISTERED Komodo Stack — Production included.** A hand-installed
  stack (on-host but untracked by Komodo) is a defect the Stack Registration Audit (§8.1,
  `komodo-verify.sh` / `cicd-gen --audit`) must catch and register; the audit is fail-open on tooling,
  fail-closed on a real untracked-prod finding. Production stays MANUAL-trigger — never auto-on-`main`.
- **Build once, promote the same bytes** — never rebuild an image between tiers.
- **Rollback couples image + schema**, or guardrails the mismatch; prefer fixing forward.
- **Demo self-heal restores a blessed golden snapshot**, never the rolling operational backup.

Companion authorities: `~/.claude/rules/deploy-discipline.md` (3-tier NL deploy contract) ·
`~/.claude/rules/staging-refresh-gate.md` (staging gate detail + the `staging-gate/` generator) ·
`templates.md` (compose/env templates) · `~/.claude/rules/versioning-standard.md` (`-rc.N` tags ride
the tiers) · `~/.claude/rules/media-storage-default.md` (demo media backend the self-heal restores).
