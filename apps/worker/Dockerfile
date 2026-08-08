# Stage 1 — install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@10.11.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/jobs/package.json ./packages/jobs/
RUN pnpm install --frozen-lockfile

# Stage 2 — build
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.11.0
COPY --from=deps /app/ ./
COPY . .
ENV SKIP_ENV_VALIDATION=1
RUN pnpm --filter @orqafy/db db:generate
RUN pnpm --filter @orqafy/db build
RUN pnpm --filter @orqafy/jobs build
RUN pnpm --filter @orqafy/worker build

# Stage 3 — minimal production runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Upgrade OS packages to pick up patched openssl (CVE-2026-45447 and any future alpine patches)
# tzdata ships the zoneinfo DB so TZ (set via compose env, e.g. Asia/Manila) actually resolves.
RUN apk upgrade --no-cache && \
    apk add --no-cache tzdata && \
    # Patch npm's bundled picomatch (CVE-2026-33671) — npm ships 4.0.3; 4.0.4 is fixed.
    npm install -g picomatch@4.0.4 --silent && \
    cp -r /usr/local/lib/node_modules/picomatch/. /usr/local/lib/node_modules/npm/node_modules/picomatch/ && \
    addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker

# Preserve pnpm workspace layout so symlinks resolve at runtime.
# apps/worker/node_modules contains pnpm symlinks like:
#   apps/worker/node_modules/ioredis -> ../../node_modules/.pnpm/ioredis@X/node_modules/ioredis
# Those targets MUST be reachable, so we copy the root-level .pnpm tree too.
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker/package.json ./apps/worker/
COPY --from=builder /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

# Remove dev-only packages not needed at runtime (test/tooling only — never imported by the worker).
# - vite/vitest: eliminates CVE-2026-53571 (vite Windows-path bypass).
# - lefthook: git-hook manager (root devDependency). Its lefthook-linux-x64 Go binary carries
#   CVE-2026-42504 (Go stdlib MIME-header decode DoS) and has ZERO runtime purpose in the worker.
#   The full root node_modules is copied above to preserve pnpm symlink targets, which drags these in.
RUN find /app/node_modules/.pnpm -maxdepth 1 -name "vite@*" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules/.pnpm -maxdepth 1 -name "vitest@*" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules/.pnpm -maxdepth 1 -name "@vitest*" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules/.pnpm -maxdepth 1 -name "lefthook@*" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules/.pnpm -maxdepth 1 -name "lefthook-*" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules -name "lefthook" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules -name "lefthook-linux-*" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules -name "lefthook-*" -path "*.bin*" -exec rm -f {} + 2>/dev/null || true

USER worker
EXPOSE 42952
ENV WORKER_PORT=42952
CMD ["node", "apps/worker/dist/index.js"]
