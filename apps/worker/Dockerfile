# Stage 1 — install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/jobs/package.json ./packages/jobs/
RUN pnpm install --frozen-lockfile

# Stage 2 — build
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
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
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker

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

USER worker
EXPOSE 42952
ENV WORKER_PORT=42952
CMD ["node", "apps/worker/dist/index.js"]
