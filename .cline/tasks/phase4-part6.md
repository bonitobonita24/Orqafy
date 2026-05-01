# Phase 4 Part 6 — apps/mobile (Expo scaffold) — SKIP if no mobile declared
TASK: Generate the Expo mobile application scaffold (Part 6 of 8).
- Read STATE.md first. Confirm Part 5 complete.
- Read inputs.yml — check if mobile app is declared.
- IF no mobile app declared: skip this Part entirely.
  Rewrite STATE.md: PHASE="Phase 4 Part 6 skipped (no mobile)", NEXT="Start Part 7 in new session".
  Output: "✅ Part 6 skipped (no mobile app declared). Open phase4-part7.md in a NEW Claude Code session."
- IF mobile declared: Create scaffold/part-6 branch. Generate Expo scaffold with Expo Router, React Native Reusables, offline sync (if declared), push notifications (if declared).
- Run: pnpm typecheck. Fix all errors. Rewrite STATE.md. Commit. Squash-merge. Delete branch.
- Output: "✅ Part 6 complete. Open phase4-part7.md in a NEW Claude Code session."
STOP HERE.
