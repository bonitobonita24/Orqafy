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
