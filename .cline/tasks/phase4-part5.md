# Phase 4 Part 5 — apps/web (Next.js full scaffold)
TASK: Generate the Next.js web application scaffold (Part 5 of 8).
- Read STATE.md first. Confirm Part 4 complete.
- Read inputs.yml + PRODUCT.md (modules, workflows, roles).
- Read DECISIONS_LOG.md. Read .cline/memory/lessons.md.
- Create scaffold/part-5 branch.
- FIRST: Initialize shadcn/ui: npx shadcn@latest init + install base components.
- Generate: tsconfig.json, src/env.ts, src/app/ (App Router), src/server/trpc/, src/server/auth/, src/middleware.ts, src/components/, next.config.ts (with security headers), src/server/lib/rate-limit.ts, src/server/lib/sanitize.ts, Dockerfile (if docker.publish: true), .dockerignore.
- Run: pnpm lint + pnpm typecheck for this Part. Fix all errors.
- Rewrite STATE.md. Commit. Squash-merge. Delete branch.
- Output: "✅ Part 5 complete. Open phase4-part6.md in a NEW Claude Code session."
STOP HERE.
