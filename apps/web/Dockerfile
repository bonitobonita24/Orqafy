# Stage 1 — install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@10.11.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/jobs/package.json ./packages/jobs/
COPY packages/storage/package.json ./packages/storage/
RUN pnpm install --frozen-lockfile

# Stage 2 — build
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.11.0
COPY --from=deps /app/ ./
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
# NEXT_PUBLIC_ vars are inlined at build time by Next.js — must be ARG+ENV here.
# The real prod sitekey is injected via --build-arg in the CI workflow (docker-publish.yml).
# If not provided, falls through to the value in .env.example (test key) — safe for staging.
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY}
RUN pnpm --filter @orqafy/db db:generate
RUN pnpm --filter @orqafy/db build
RUN pnpm --filter @orqafy/jobs build
RUN pnpm --filter @orqafy/web build

# Stage 3 — minimal production runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Upgrade OS packages to pick up patched openssl (CVE-2026-45447 and any future alpine patches)
# tzdata ships the zoneinfo DB so TZ (set via compose env, e.g. Asia/Manila) actually resolves.
RUN apk upgrade --no-cache && \
    apk add --no-cache tzdata && \
    # Patch npm's bundled picomatch (CVE-2026-33671) — npm ships 4.0.3; 4.0.4 is fixed.
    # npm is a dev tool not used at runtime, but Trivy flags it. Copy patched version over.
    npm install -g picomatch@4.0.4 --silent && \
    cp -r /usr/local/lib/node_modules/picomatch/. /usr/local/lib/node_modules/npm/node_modules/picomatch/ && \
    addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
