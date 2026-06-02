# Orqafy — Operator Handoff (Staging Deploy)

**Generated:** 2026-06-02 · **Branch:** main · **Code state:** CI fully green, all credentials filled

---

## TL;DR

Everything code-side is done. All credentials are filled in `CREDENTIALS.md`, `.env.staging`, and `.env.prod`. The only remaining work is **operator action in the Komodo UI** — no code changes, no terminal work on the dev machine.

**Estimated time:** 25–35 minutes for staging. Production is gated separately (waits for staging verification).

---

## What's Already Done (no action needed)

- ✅ All 6 CI jobs green on `main` (governance, audit, lint, test, build, typecheck)
- ✅ `CREDENTIALS.md` filled: SMTP, Komodo UI URL, Xendit TEST + LIVE keys, webhook token
- ✅ `.env.staging` and `.env.prod` fully populated (zero ⏳ markers)
- ✅ `deploy/compose/stage/` compose files V27-clean: no `build:` key, Traefik labels wired, pulls `:staging-latest` from Docker Hub
- ✅ `docker-publish.yml` already pushes `:staging-latest`, `:latest`, and `:sha-{hash}` tags on every merge to main

---

## Staging Deploy — Step by Step

### Step 1 — Verify Docker Hub has a `:staging-latest` image

Open Docker Hub: https://hub.docker.com/r/bonitobonita24/orqafy/tags

You should see `staging-latest` listed. If not, push any trivial commit to `main` to trigger `docker-publish.yml`:

```
git commit --allow-empty -m "chore(ci): trigger first staging image build"
git push origin main
```

Wait ~5 minutes for the GitHub Actions `Docker Build & Publish` workflow to finish. Confirm the tag appears.

---

### Step 2 — Verify Traefik proxy network exists on the Komodo server

SSH into the Komodo server (where staging will run). Run:

```
docker network ls | grep proxy
```

Expected output:
```
abc123def456   proxy   bridge   local
```

If the `proxy` network does NOT exist, create it:
```
docker network create proxy
```

(This is required because the app service joins `proxy` for HTTPS routing via Traefik. The compose file references it as `external: true`.)

---

### Step 3 — Add Docker Hub credentials to Komodo

Komodo UI → **Settings → Providers → Add Docker Registry**

| Field | Value |
|-------|-------|
| Domain | `docker.io` |
| Username | `bonitobonita24` |
| Token | (from `CREDENTIALS.md` → Docker Hub section — your access token, NOT password) |

Save. This lets Komodo pull the image.

---

### Step 4 — Create the Staging Stack in Komodo

Komodo UI → **Stacks → New Stack**

| Field | Value |
|-------|-------|
| Name | `orqafy-staging` |
| Server | (your server name in Komodo) |
| Run directory | `/opt/stacks/orqafy-staging` |
| **auto_update** | **true** ✅ (this enables auto-pull when CI pushes a new `:staging-latest`) |

---

### Step 5 — Paste the staging compose into the Stack

Komodo UI → **Stack → Compose** tab.

Copy the **entire contents** of these 6 files into one compose document (Komodo expects a single compose file per Stack):

1. `deploy/compose/stage/docker-compose.db.yml`
2. `deploy/compose/stage/docker-compose.cache.yml`
3. `deploy/compose/stage/docker-compose.storage.yml`
4. `deploy/compose/stage/docker-compose.pgadmin.yml`
5. `deploy/compose/stage/docker-compose.worker.yml`
6. `deploy/compose/stage/docker-compose.app.yml`

**Merge rules:**
- Combine all `services:` blocks under a single `services:` key
- Combine all `volumes:` blocks under a single `volumes:` key
- Combine all `networks:` blocks under a single `networks:` key
- Remove duplicate network definitions (the `app_network` and `proxy` definitions appear in multiple files — keep only one of each)

Save the Stack — do NOT deploy yet.

---

### Step 6 — Paste the staging environment into the Stack

Komodo UI → **Stack → Environment** tab.

Copy the **entire contents** of `.env.staging` from the repo into this field.

Save.

---

### Step 7 — Deploy the Stack

Komodo UI → **Stack → Deploy** button.

Komodo will:
1. Pull all images (postgres, valkey, minio, pgadmin, bonitobonita24/orqafy:staging-latest)
2. Create volumes (`orqafy_staging_postgres_data`, etc.)
3. Create the `orqafy_staging_network` Docker network
4. Start all services in dependency order
5. Wait for healthchecks to pass

Watch the Stack log in the Komodo UI. First deploy takes ~3–5 minutes.

---

### Step 8 — Run database migrations + seed

SSH into the Komodo server. Run:

```
docker exec orqafy_staging_app pnpm db:migrate deploy
docker exec orqafy_staging_app pnpm db:seed
```

The seed creates the `webmaster` admin account. Its password is in `CREDENTIALS.md` → First Admin Account section.

---

### Step 9 — Verify staging is live

From your dev machine:
```
curl -sI https://orqafy-staging.powerbyte.app/api/health
```

Expected: `HTTP/2 200`.

Open in browser: https://orqafy-staging.powerbyte.app
- Login page should render
- Log in as `webmaster` (password in CREDENTIALS.md)
- Dashboard loads with no console errors

If TLS fails: Traefik may still be issuing the Let's Encrypt cert (takes ~30 seconds on first request). Retry.

---

### Step 10 — Verify auto-update works

Push any trivial commit to `main`:
```
git commit --allow-empty -m "chore(ci): verify staging auto-update"
git push origin main
```

Within ~10 minutes (CI build time + Komodo poll interval):
- GitHub Actions builds and pushes a new `:staging-latest`
- Komodo detects the new digest and auto-redeploys the `app` container
- All other services stay running (zero downtime for DB, cache, storage)

Confirm by checking Komodo Stack history — should show an automatic redeploy event.

---

## What's NOT in scope for this handoff

**Production deploy** — gated on staging verification. Production needs additionally:

- Cloudflare Turnstile **LIVE** keys (currently using TEST keys — see `CREDENTIALS.md` → Turnstile section, marked ⏳ for prod only)
- Cloudflare R2 credentials (if migrating from MinIO — currently using MinIO in both envs)
- Production Stack provisioned with `auto_update: false` (manual deploy from UI after verifying staging)

When staging is stable for ~1 week, repeat Steps 4–9 with the `prod/` compose files, `.env.prod`, and `:latest` image tag.

---

## Rollback (if staging deploy fails)

In Komodo UI → Stack → Environment, change:
```
APP_IMAGE_TAG=staging-latest
```
to a known-good SHA tag from Docker Hub:
```
APP_IMAGE_TAG=sha-{previous-good-short-sha}
```

Click Deploy. Only the `app` container restarts; DB/cache/storage stay running with all data intact.

---

## Troubleshooting quick reference

| Symptom | Fix |
|---------|-----|
| `network proxy not found` | Run `docker network create proxy` on Komodo server (Step 2) |
| `pull access denied` | Re-add Docker Hub creds in Komodo Providers (Step 3) |
| `port already in use` | Another Stack on the server is using staging's ports. Check `docker ps` and either stop the conflicting Stack or change ports in `.env.staging` |
| TLS cert pending | Wait 30s on first request — Let's Encrypt is issuing. If still failing after 5 min, check Traefik logs |
| App container restarts | Check `docker logs orqafy_staging_app` — most common cause is DB migration not run (do Step 8) |

---

## Reference

- Full Komodo setup guide: `.claude/rules/scenarios.md` → Scenario 32
- Compose file V27 conventions: `.claude/rules/scenarios.md` → Scenario 24
- All credentials: `CREDENTIALS.md` (gitignored)
- All push commands: `COMMANDS.md`
- Session checkpoint that closed code-side work: commit `6b993dd`
