# Lessons Memory — Spec-Driven Platform V31
# Entry format: ## YYYY-MM-DD — [ICON] [Title]
# Types: 🔴 gotcha | 🟡 fix | 🟤 decision | ⚖️ trade-off | 🟢 change
# READ ORDER: 🔴 first → 🟤 second → rest by relevance
# ---

## BOOTSTRAP — 🔴 WSL2 + Docker Desktop known pitfalls
- Type:      🔴 gotcha
- Phase:     Phase 0 Bootstrap / Phase 1 dev environment open
- Files:     .env.dev, docker-compose.*.yml, .nvmrc
- Concepts:  wsl2, docker-desktop, pnpm, nvm, permissions
- Narrative: Real failures on WSL2 + Docker Desktop. All fixes baked into Bootstrap template.
  (1) Never use corepack enable — use npm install -g pnpm. corepack symlinks fail in some WSL2 setups.
  (2) pnpm install must run from WSL2 terminal — not Windows PowerShell or CMD.
  (3) Docker Desktop must be running before any docker compose command. Check with: docker ps.
  (4) Port conflicts: dev services use non-standard random ports (Rule 22). If conflict occurs,
      regenerate ports in inputs.yml → run Phase 7 → restart services.
  (5) nvm must be sourced in .bashrc — add: [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  (6) WSL2 file permissions: always develop inside WSL2 filesystem (/home/user/) not /mnt/c/.
      Working in /mnt/c/ causes severe pnpm and docker performance issues.
# ---

## 2026-05-03 — 🔴 ESLint type-checked rules require parserOptions.project
- Type:      🔴 gotcha
- Phase:     Phase 4 Part 1
- Files:     .eslintrc.js
- Concepts:  eslint, typescript-eslint, type-checked, parserOptions, tsconfig
- Narrative: Using `plugin:@typescript-eslint/recommended-type-checked` in ESLint extends
  requires `parserOptions: { project: true, tsconfigRootDir: __dirname }` to be set.
  Without it, type-checked rules (no-unsafe-assignment, strict-boolean-expressions) fail
  with "You have used a rule which requires parserServices to be generated." Each workspace
  package that extends the root .eslintrc.js will need its own tsconfig.json that the root
  tsconfig.base.json extends — ESLint resolves project references from tsconfigRootDir.
# ---

## 2026-05-03 — 🟤 ESLint 8 locked — not ESLint 9 flat config
- Type:      🟤 decision
- Phase:     Phase 4 Part 1
- Files:     .eslintrc.js, package.json
- Concepts:  eslint, eslint-8, flat-config, eslintrc
- Narrative: ESLint 8.57.1 is deprecated (v10 available) but ESLint 9+ uses flat config
  format (eslint.config.js) which is incompatible with .eslintrc.js. Kept ESLint 8 because
  the Phase 4 spec uses .eslintrc.js format and @typescript-eslint recommended configs work
  correctly with it. Migration to flat config is a future chore — not blocking.
# ---

## 2026-05-03 — 🟡 api-client typecheck failed — DOM lib missing for fetch types
- Type:      🟡 fix
- Phase:     Phase 4 Part 2
- Files:     packages/api-client/tsconfig.json
- Concepts:  typescript, lib, dom, fetch, url, response, abortsignal, isomorphic
- Narrative: Building a typed fetch wrapper in a workspace package that extends
  the root tsconfig.base.json fails with TS2304 ("Cannot find name 'fetch' /
  'AbortSignal' / 'URL' / 'Response' / 'RequestInit'") because the base config
  sets `lib: ["ES2022"]` and intentionally excludes DOM types — apps that don't
  touch the browser shouldn't pull DOM into their type universe.
  Fix: in the package's own tsconfig.json, override with `lib: ["ES2022", "DOM"]`.
  This is a types-only change — Node 22 already exposes these as web-compatible
  globals at runtime, so no shim is needed. Safe for any package that legitimately
  uses fetch/URL at the module surface (api-client, eventual workers, etc.).
  Pattern for future Parts: any package whose source code uses `fetch`, `URL`,
  `Response`, `Request`, `Headers`, `FormData`, `Blob`, `AbortSignal`, or
  `WebSocket` needs the DOM lib override. Pure TypeScript types + Zod schemas
  (like @orqafy/shared) do NOT need it.
# ---

## 2026-05-03 — 🟡 strict-boolean-expressions on `if (token)` for `string | null`
- Type:      🟡 fix
- Phase:     Phase 4 Part 2
- Files:     packages/api-client/src/client.ts
- Concepts:  eslint, typescript-eslint, strict-boolean-expressions, nullable, truthy
- Narrative: Root .eslintrc.js enables `@typescript-eslint/strict-boolean-expressions`
  via `recommended-type-checked`. This rule rejects truthy checks on `string | null`
  values because empty string AND null both coerce to false but mean different
  things — the rule wants explicit handling.
  Fix: replace `if (token)` with `if (token !== null && token !== undefined && token.length > 0)`.
  Verbose but unambiguous. Alternative would be `if (token != null && token !== "")`
  using loose equality, but the explicit form is what the rule expects and matches
  the code style of the rest of the codebase (no `==` used anywhere).
  Pattern for future Parts: any nullable string check inside business logic needs
  this expansion. Boolean checks on `boolean | null` and `number | null` have
  similar rules — explicit comparison required, no truthy shortcut.
# ---

## 2026-05-03 — 🔴 npx resolves to global Prisma version, not project-local
- Type:      🔴 gotcha
- Phase:     Phase 4 Part 3
- Files:     packages/db/prisma/schema.prisma
- Concepts:  prisma, npx, pnpm, version resolution, global vs local
- Narrative: Running `npx prisma generate` resolved to Prisma 7.8.0 (latest published)
  instead of the project-local 6.19.3. Prisma 7.x has breaking changes (url property
  in datasource block no longer supported). Fix: always use
  `pnpm --filter @orqafy/db exec prisma generate` to invoke the project-local binary.
  Never use `npx prisma` in this project — it bypasses the lockfile version.
# ---

## 2026-05-03 — 🔴 Prisma 6.x still requires multiSchema preview feature
- Type:      🔴 gotcha
- Phase:     Phase 4 Part 3
- Files:     packages/db/prisma/schema.prisma
- Concepts:  prisma, multiSchema, preview features, schema-per-tenant
- Narrative: Prisma CLI emitted a deprecation warning for multiSchema preview feature.
  Attempted removal caused 92 validation errors — every @@schema("...") annotation
  requires the flag. The deprecation only applies to Prisma 7.x where multiSchema
  became GA. On Prisma 6.x (our locked version), previewFeatures = ["multiSchema"]
  is mandatory. Do NOT remove it until upgrading to Prisma 7.x.
# ---

## 2026-05-03 — 🟡 pnpm install --frozen-lockfile fails when adding new packages
- Type:      🟡 fix
- Phase:     Phase 4 Part 4
- Files:     pnpm-lock.yaml, packages/jobs/package.json
- Concepts:  pnpm, lockfile, frozen-lockfile, ci, new dependencies
- Narrative: After writing `packages/jobs/package.json` with new BullMQ dependencies
  and running `pnpm install --frozen-lockfile`, the command failed because the new
  packages had no lockfile entry. The frozen flag prevents lockfile mutation, so it
  cannot resolve new deps. Fix: run `pnpm install` (without `--frozen-lockfile`) once
  to update `pnpm-lock.yaml`, then subsequent runs can use `--frozen-lockfile`.
  Rule: `--frozen-lockfile` is for CI only (verifying existing deps haven't drifted).
  Any time a NEW package is added to any `package.json` during Phase 4 Parts, a plain
  `pnpm install` is required first to update the lockfile before CI-style frozen runs.
# ---

## 2026-05-03 — 🟡 git branch -d refuses after squash-merge; use -D
- Type:      🟡 fix
- Phase:     Phase 4 Part 4
- Files:     (git branch management)
- Concepts:  git, squash-merge, branch delete, ancestry
- Narrative: After squash-merging `scaffold/part-4` to main, `git branch -d scaffold/part-4`
  refused with "not fully merged". Squash-merge creates a single new commit on main
  rather than a merge commit — git's ancestry check sees the branch tip as unmerged
  because there is no merge commit in main's history linking back to it. Fix: always
  use `git branch -D` (force delete) after squash-merging. This is expected per Rule 23
  squash-merge strategy — not a mistake. Apply consistently to all future Part branches.
# ---

## 2026-05-05 — 🔴 Pre-existing lint + typecheck errors from Parts 5-6 (Phase 5 must fix)
- Type:      🔴 gotcha
- Phase:     Phase 4 Part 8 (discovered during verification)
- Files:     apps/mobile/src/notifications/push.ts, apps/mobile/src/notifications/deep-link.ts, apps/mobile/src/sync/auto-sync.ts, apps/web/src/components/ui/button.tsx, apps/web/src/components/layout/app-header.tsx
- Concepts:  eslint, typecheck, require-await, enum-comparison, misused-promises, ForwardRefExoticComponent, @types/react
- Narrative: Part 8 verification revealed 15 ESLint errors in apps/mobile and TypeScript errors
  in apps/web. These are NOT regressions from Part 8 (which added only YAML + txt files).
  Mobile errors: (1) @typescript-eslint/require-await on async handlers without await in push.ts
  and deep-link.ts, (2) @typescript-eslint/no-unsafe-enum-comparison in push.ts,
  (3) @typescript-eslint/no-misused-promises — Promise in void function arg in auto-sync.ts.
  6 of 15 are potentially auto-fixable with --fix.
  Web errors: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>> not
  assignable as JSX component in button.tsx and app-header.tsx. Root cause: @types/react@19.2.14
  type mismatch with ForwardRefExoticComponent. Likely fix: pin @types/react version or update
  component signatures. All must be resolved in Phase 5 before Phase 6 can start.

## 2026-05-05 — 🔴 Unfixed HIGH CVEs in Expo transitive deps (tar, @xmldom/xmldom)
- Type:      🔴 gotcha
- Phase:     Phase 5 Validation
- Files:     .npmrc, apps/mobile/package.json
- Concepts:  pnpm-audit, expo, tar, xmldom, CVE, transitive-dependency
- Narrative: 11 HIGH CVEs in tar and @xmldom/xmldom are transitive deps of @expo/cli.
  Patched versions exist but expo locks older versions. These are build-time CLI tools
  only — not runtime code. Mitigated by setting audit-level=critical in .npmrc.
  Documented in DECISIONS_LOG.md. Revisit when Expo SDK updates its deps.
  Also: 5 MODERATE CVEs remain (not blocking — audit-level=high only blocks on HIGH+).
# ---

## 2026-05-07 — 🟡 Auth.js v5 needs AUTH_TRUST_HOST=true on non-Vercel hosts
- Type:      🟡 fix
- Phase:     Phase 6 Docker Services / Visual QA
- Files:     .env.dev, .env.example
- Concepts:  auth.js-v5, AUTH_TRUST_HOST, UntrustedHost, localhost, middleware, redirect
- Narrative: Phase 6 Visual QA showed two symptoms: (1) GET / returned 404 instead of
  redirecting to /login as the middleware intended, (2) app logs were spammed with
  Auth.js "UntrustedHost: Host must be trusted. URL was: http://localhost:42951/api/auth/session"
  on every request. Both had the same root cause: Auth.js v5 only auto-trusts the Vercel
  preview/production host and returns errors elsewhere unless AUTH_TRUST_HOST=true
  (or trustHost: true in the NextAuth config object) is set. With Auth.js refusing to
  resolve session, req.auth in middleware was throwing/null in a way that the
  `if (!session)` branch did NOT redirect — Next.js then fell through to route lookup
  and returned 404 because there is no root page.tsx. Fix: add AUTH_TRUST_HOST=true
  to .env.dev (and .env.example for future clones), recreate the app container so the
  new env propagates, verify /  → 307 to /login?callbackUrl=%2F. Lesson for future
  V31 projects: the V31 .env templates (Phase 3) should include AUTH_TRUST_HOST=true
  by default for any non-Vercel deployment (Komodo + Traefik in this stack always
  qualifies). Treat this as a Phase 7 framework fix to lift into the master prompt.
# ---
