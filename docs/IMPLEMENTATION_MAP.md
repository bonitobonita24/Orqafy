# Implementation Map — Orqafy
# Current build state snapshot. Rewritten after every task.
# ---

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 — Bootstrap | ✅ Complete | Project structure initialized |
| Phase 1 — Dev Environment | ⬜ Pending | Optional — skip if Node 22 + pnpm + WSL2 ready |
| Phase 2 — Discovery Interview | ⬜ Pending | PRODUCT.md exists from Planning Assistant |
| Phase 2.5 — Spec Summary | ⬜ Pending | |
| Phase 2.6 — Design System | ⬜ Pending | DESIGN.md exists from Planning Assistant |
| Phase 2.7 — Spec Stress-Test | ⬜ Pending | |
| Phase 3 — Generate Spec Files | ⬜ Pending | |
| Phase 4 — Full Scaffold | ⬜ Pending | 8 Parts, fresh session each |
| Phase 5 — Validation | ⬜ Pending | Human trigger |
| Phase 6 — Docker + Visual QA | ⬜ Pending | Human trigger |
| Phase 7 — Feature Updates | ⬜ Pending | The daily loop |
| Phase 8 — Iterative Buildout | ⬜ Pending | |

## Packages

| Package | Status | Description |
|---------|--------|-------------|
| packages/shared | ⬜ | TypeScript types + Zod schemas |
| packages/api-client | ⬜ | Typed tRPC client |
| packages/db | ⬜ | Prisma schema + migrations |
| packages/ui | ⬜ | shadcn/ui components |
| packages/jobs | ⬜ | BullMQ job queues |
| packages/storage | ⬜ | MinIO/S3 file storage |

## Apps

| App | Status | Description |
|-----|--------|-------------|
| apps/web | ⬜ | Next.js web application |
| apps/mobile | ⬜ | Expo mobile app (if declared) |

## Infrastructure

| Component | Status | Description |
|-----------|--------|-------------|
| deploy/compose/ | ⬜ | Docker Compose files (dev/stage/prod) |
| tools/ | ⬜ | Validation scripts |
| .github/workflows/ | ⬜ | CI + Docker publish |
