# Phase 4 Part 8 — CI + governance docs + MANIFEST.txt + SocratiCode index
TASK: Generate CI workflows, governance docs, and final project manifest (Part 8 of 8).
- Read STATE.md first. Confirm Part 7 complete.
- Read ALL 9 governance docs.
- Create scaffold/part-8 branch.
- Generate: .github/workflows/ci.yml, .github/workflows/docker-publish.yml (if docker.publish: true), MANIFEST.txt (every file across all 8 parts).
- Append to docs/CHANGELOG_AI.md (Agent: CLAUDE_CODE).
- Rewrite docs/IMPLEMENTATION_MAP.md — complete current state snapshot.
- Trigger SocratiCode index: codebase_index {} → poll codebase_status {} → codebase_context_index {}.
- Run: pnpm lint + pnpm typecheck. Fix all errors. Rewrite STATE.md. Commit. Squash-merge. Delete branch.
- Output: "✅ Part 8 complete. Say 'Start Phase 5' in a NEW Claude Code session."
STOP HERE. Do not proceed to Phase 5 in this session.
