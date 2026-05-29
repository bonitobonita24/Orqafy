# Deployment Guide — Direction F (Per-Tenant Xendit) + Batch 22 Prod-Readiness

> Single source of truth for rolling out Batches 21a, 21b, 21c, and 22 to
> staging and production. Assumes Komodo + Docker Hub pipeline already
> exists per Scenario 32. If those are not yet set up, read Scenario 32
> first then return here.

---

## What's shipping

| Batch | Title | Commit |
|-------|-------|--------|
| 21a | AES-256-GCM encryption infrastructure (`crypto.ts` + `APP_ENCRYPTION_KEY` env var) | `976df52` |
| 21b | `TenantXenditConfig` CRUD + admin UI with verify-before-use gating | `ff61bea` |
| 21c | Per-tenant Xendit consumer refactor (storefront + webhook resolve tenant-scoped credentials) | `abe57ce` |
| 22 | Turnstile on guest checkout + webhook `webhookProcessedAt` audit field | _this batch_ |

Net new infrastructure requirements introduced by Direction F + Batch 22:
1. `APP_ENCRYPTION_KEY` (32-byte base64) — required by `crypto.ts`. Without it, every checkout AND every webhook throws at decrypt-time.
2. Three new Prisma migrations to apply:
   - `20260521194500_add_tenant_id_to_ecommerce_orders` — 3-stage NOT-NULL backfill (Batch 21c)
   - `20260529014600_add_webhook_processed_at_to_ecommerce_orders` — additive nullable (Batch 22)
   - `20260529080000_add_tenant_id_to_ecommerce_order_items` — 3-stage backfill from parent order (Batch 24 — Direction G defense-in-depth, no runtime behavior change)
3. Cloudflare Turnstile production sitekey/secret (only if not already set).
4. Per-tenant Xendit credentials are now entered through the admin UI at runtime (no env vars to populate — `XENDIT_SECRET_KEY` and `XENDIT_WEBHOOK_TOKEN` were removed from `env.ts` in Batch 21c).

---

## Pre-flight checklist

Run these BEFORE applying anything to staging or prod.

- [ ] All four commits (21a, 21b, 21c, 22) are on `main` and pushed to `origin`.
- [ ] GitHub Actions has built and pushed the image: `:latest` for prod, `:staging-latest` for staging.
- [ ] You have access to the Komodo UI for the target stack.
- [ ] You have access to `CREDENTIALS.md` (gitignored — local-only).
- [ ] You have a backup or snapshot of the target environment's PostgreSQL.

---

## 1. Generate and place `APP_ENCRYPTION_KEY`

Generate a unique 32-byte base64 key for EACH environment. Do NOT reuse across envs.

```bash
# Run THREE times — once per environment
openssl rand -base64 32 | tr -d '\n' | head -c 44
```

Update `CREDENTIALS.md` (gitignored) with the new values:

```markdown
## 🔐 Application Encryption (Direction F)

| Environment | APP_ENCRYPTION_KEY              | Notes                         |
|-------------|---------------------------------|-------------------------------|
| dev         | <44-char base64>                | Already set in .env.dev       |
| staging     | <44-char base64 — fill before deploy> | Required for Xendit          |
| prod        | <44-char base64 — fill before deploy> | Required for Xendit          |
```

Then place each value in the matching env file on the host or in the Komodo Stack env config:

- `.env.staging`: `APP_ENCRYPTION_KEY=<staging-value>`
- `.env.prod`:    `APP_ENCRYPTION_KEY=<prod-value>`

**Hard rules**:
- 44 chars (base64-encoded 32 bytes).
- Different per environment (rotating dev never affects prod).
- Never commit. Never paste into chat. Never log.
- Rotating this key invalidates every existing encrypted column — see Rotation section below before you ever rotate in prod.

---

## 2. Apply the three new migrations

Run on EACH environment in order: dev → staging → prod.

```bash
# From the host that has DB access (Komodo runs this inside the container)
pnpm --filter @orqafy/db exec prisma migrate deploy
```

Expected output: 3 migrations applied (the tenantId migration AND the webhookProcessedAt migration AND the orderItem tenantId migration).

**About the tenantId migration (Batch 21c)** — three-stage backfill:
1. `ALTER TABLE ecommerce_orders ADD COLUMN tenant_id TEXT;` (nullable, survives ADD)
2. `UPDATE ecommerce_orders SET tenant_id = (SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1) WHERE tenant_id IS NULL;` (backfill to oldest tenant)
3. `ALTER TABLE ecommerce_orders ALTER COLUMN tenant_id SET NOT NULL;` + FK + INDEX

**Edge cases**:
- Empty DB (zero tenants, zero orders): vacuous success.
- Populated DB with zero tenants but any orders: step 3 FAILS LOUDLY. Seed at least one tenant first.
- Populated DB with multiple tenants but only one is the "real" current tenant: backfill assigns ALL existing orders to the oldest tenant. If you need finer assignment, run a manual UPDATE statement BEFORE running migrate deploy.

**About the webhookProcessedAt migration (Batch 22)** — additive nullable, no edge cases. Safe to apply on a live DB without downtime.

**About the orderItem tenantId migration (Batch 24 — Direction G)** — three-stage backfill from parent order:
1. `ALTER TABLE ecommerce_order_items ADD COLUMN tenant_id TEXT;` (nullable)
2. `UPDATE ecommerce_order_items SET tenant_id = o.tenant_id FROM ecommerce_orders o WHERE ecommerce_order_items.order_id = o.id AND ecommerce_order_items.tenant_id IS NULL;` (backfill from parent order — requires Batch 21c migration to have already run on this env)
3. `ALTER TABLE ecommerce_order_items ALTER COLUMN tenant_id SET NOT NULL;` + FK ON DELETE RESTRICT ON UPDATE CASCADE + INDEX. No runtime behavior change — defense-in-depth only.

---

## 3. Update the Komodo Stack environment

After placing `APP_ENCRYPTION_KEY` in the host `.env.{env}` file (or directly in Komodo's Stack env config), restart the app service so it picks up the new env var.

```bash
# Komodo UI: Stack → <stack-name> → Environment → paste the new APP_ENCRYPTION_KEY → Save
# Komodo UI: Stack → <stack-name> → Restart  (or click Deploy if you also want to pull a new image)
```

Or via terminal on the host:

```bash
docker compose -f deploy/compose/stage/docker-compose.app.yml restart app
# or:
docker compose -f deploy/compose/prod/docker-compose.app.yml restart app
```

Verify the new env var is live inside the container:

```bash
docker exec <stack-name>_app sh -c 'echo "APP_ENCRYPTION_KEY length: ${#APP_ENCRYPTION_KEY}"'
# Expected: 44
```

If the length prints `0`, the env var didn't propagate — restart the stack again or check the env file path.

---

## 4. Cloudflare Turnstile production sitekey/secret (Batch 22)

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` were already declared in `env.ts` since framework bootstrap, and `.env.staging` + `.env.prod` already carry the test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) per Cloudflare convention. Test keys ALWAYS pass — fine for staging but NOT acceptable for production.

For production, replace the test keys with real ones:

1. Go to https://dash.cloudflare.com → Turnstile → "Add Widget".
2. Widget name: `orqafy-prod` (or your slug).
3. Hostname: register only your production domain (one hostname slot used out of ten per widget on the FREE tier).
4. Widget mode: **Managed** (Cloudflare auto-decides whether to show a checkbox).
5. Copy the Site Key and Secret Key.
6. Update `CREDENTIALS.md` (gitignored) with the LIVE values.
7. Update `.env.prod` on the host:
   ```
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=<live-site-key>
   TURNSTILE_SECRET_KEY=<live-secret-key>
   ```
8. Restart the prod app service (as in step 3).

**Staging stays on test keys** — saves the hostname budget for the one widget that matters (prod). Dev too.

---

## 5. First-tenant onboarding (after deploy)

Once the four batches are live AND `APP_ENCRYPTION_KEY` is set AND migrations have run, the admin UI is the only path to activate Xendit per tenant.

For each tenant that should accept Xendit payments:

1. Sign in as a tenant admin.
2. Navigate to `/admin/xendit-config` (or wherever the admin nav routes it).
3. Enter the Xendit Secret API Key, Public API Key, and Webhook Verification Token. All three are required.
4. Click "Test Connection". This calls `admin-xendit-config.testConnection`, which instantiates the Xendit SDK directly (bypassing the `getXenditClient` cache) and attempts a no-op invoice operation.
5. On success, `isVerified` flips to `true` and the record is persisted with the secret-key and webhook-token columns encrypted via `APP_ENCRYPTION_KEY`.
6. From that point on, storefront checkout (protected AND guest paths) will create Xendit invoices for this tenant, and the webhook handler will resolve and verify the per-tenant token correctly.

**If `isVerified` stays `false`** — the storefront will silently fall back to non-Xendit payment methods, and the webhook handler will return 401 for any incoming webhook. Re-run "Test Connection" after fixing the credentials.

---

## 6. Rollback procedure

The image tag is immutable (`prod-sha-{hash}`). To roll back to the version before this batch:

1. Find the pre-batch commit's short SHA on `main` (use `git log --oneline -20`).
2. Komodo UI → Stack → Environment → change `APP_IMAGE_TAG=prod-sha-{previous-hash}`.
3. Click Deploy.
4. Komodo pulls the previous image from Docker Hub and restarts.

**Migrations cannot be rolled back automatically** — they are forward-only. If you must reverse a migration:

- `webhookProcessedAt` (Batch 22) — safe to leave in place after rollback. The previous code simply doesn't write to it. No data loss.
- `tenantId` on EcommerceOrder (Batch 21c) — leaving it in place after rollback also fine. The pre-21c code didn't read it, so the column is dormant. If you absolutely must drop it: `ALTER TABLE ecommerce_orders DROP COLUMN tenant_id;` AND the FK constraint and index — but this destroys per-tenant data integrity if you ever re-apply, so prefer to fix forward.

**`APP_ENCRYPTION_KEY` rollback** — if you rolled back to a pre-21a image, the env var is harmless (the old code never reads it). Leave it set so re-deploying doesn't require regenerating.

---

## 7. Key rotation (future operation, not part of this rollout)

Rotating `APP_ENCRYPTION_KEY` invalidates every encrypted column written under the old key. There is currently NO bulk re-encryption tool. If you ever need to rotate:

1. Build a one-off script that reads each `TenantXenditConfig` row, decrypts with the OLD key, re-encrypts with the NEW key, and updates the row.
2. Run the script transactionally per tenant.
3. Only after all rows are re-encrypted, swap the env var on the running app.

For the foreseeable future, treat `APP_ENCRYPTION_KEY` as set-once-per-environment.

---

## 8. Quick verification after deploy

After all six steps above complete, validate end-to-end on staging before promoting to prod:

```bash
# 1. App responds
curl -fsS https://${staging_domain}/api/health
# Expected: { "ok": true, ... }

# 2. Admin UI loads
# Open https://${staging_domain}/admin/xendit-config in a browser. Should render without 500.

# 3. Guest checkout loads with Turnstile widget
# Open https://${staging_domain}/<tenant-slug>/store/checkout — Turnstile widget renders before the submit button.

# 4. Webhook handler responds 401 to unauthenticated request (sanity)
curl -fsS -X POST https://${staging_domain}/api/webhooks/xendit \
  -H 'content-type: application/json' \
  -d '{"id":"x","external_id":"y","status":"PAID"}'
# Expected: HTTP 401 (no x-callback-token header)
```

If all four pass on staging AND a tenant has completed first-tenant onboarding successfully, promote to prod by:
1. Komodo UI → prod Stack → Deploy (image tag stays at `:latest` which is now Batch 22).
2. Repeat verification steps against the prod domain.

---

## References

- Scenario 32 (in `.claude/rules/scenarios.md`): full Komodo + Docker Hub pipeline setup.
- `CREDENTIALS.md` (gitignored): per-environment secrets ledger.
- `.whatsnext` at project root: current direction queue.
- `STATE.md` at `.cline/`: most recent batch's checkpoint.
