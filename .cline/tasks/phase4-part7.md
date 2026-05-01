# Phase 4 Part 7 — tools/ + deploy/compose/ + SocratiCode artifacts
TASK: Generate tooling, Docker Compose files, and deployment scripts (Part 7 of 8).
- Read STATE.md first. Confirm Part 5 (or Part 6) complete.
- Read inputs.yml (all sections). Read .cline/memory/lessons.md.
- Create scaffold/part-7 branch.
- Generate: tools/ (validate-inputs, check-env, check-product-sync, hydration-lint), deploy/compose/ (dev/stage/prod — split compose files per service group), deploy/compose/start.sh, deploy/compose/push.sh (if docker.publish: true), COMMANDS.md (if docker.publish: true), .socraticodecontextartifacts.json (MERGE if exists).
- Run: pnpm typecheck. Fix all errors. Rewrite STATE.md. Commit. Squash-merge. Delete branch.
- Output: "✅ Part 7 complete. Open phase4-part8.md in a NEW Claude Code session."
STOP HERE.
