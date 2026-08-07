# microservices.md — Microservices Escalation Standard (on-demand · deliverable #33)

> **Rule 37 authority file.** Read on-demand ONLY when a project is a candidate for — or is actively
> undergoing — microservices escalation. This is a *forward-looking* design architecture for the rare
> app that genuinely outgrows the modular monolith. It is **decompose-the-locked-stack**: the same tools
> the framework already runs, split by bounded context — not a polyglot/broker-first rewrite.
>
> **Version:** introduced V32.35 (2026-07-27). Paired with **Rule 37** (Architecture Posture) + **Scenario 47**
> (Microservices Escalation Assessment / Decomposition).

---

## ⛔ §0 — NON-DISRUPTION BANNER (read this first, every time)

**The default architecture for EVERY framework-built app — existing and future — is the MODULAR MONOLITH.**
Microservices is the **exception**, never the baseline.

- **This file arriving in `.ai_prompt/` does NOT restructure anything.** It is an inert reference document.
  Syncing V32.35 into an existing app (`deploy.sh`) only drops this blueprint on disk. It does not run,
  does not execute, does not convert a monolith into services. No existing app is auto-decomposed.
- **No app leaves the monolith without an owner-gated `[WHAT]` decision** against the §1 escalation gate.
- **Even when approved, decomposition is the STRANGLER path** — carve out one bounded context at a time
  from a running monolith. Never a big-bang rewrite. HARD HOLD applies to any topology change (LOCAL work
  only; staging/prod/demo promotion stays owner-gated per `deploy-discipline`).
- If you are reading this during ordinary feature work, **stop** — you almost certainly want the modular
  monolith. Return to the normal phases. Only continue if an escalation trigger (§1) is genuinely on the table.

---

## §1 — The escalation decision gate (when — and when NOT — to leave the monolith)

The modular monolith is right ~95% of the time for this fleet (tenant-based SaaS for SMB / LGU clients).
Microservices buy independent scaling & deployment at the cost of distributed-systems complexity
(network failure modes, eventual consistency, distributed transactions, per-service ops, harder local dev).
**Only escalate when a real trigger makes that trade worth it.**

### Escalation triggers — ANY ONE is *necessary*; NONE is *automatic* (all owner-gated `[WHAT]`)

1. **Divergent scale curve** — one workload must scale and/or deploy on a wholly different curve than the
   rest of the app (e.g. a render/transcode pipeline, a high-QPS public API, a bulk-ingest worker) and is
   throttling the monolith's resources or deploy cadence.
2. **Hard isolation boundary** — a compliance/data-residency/security boundary that shared-schema + `tenant_id`
   (or even separate-schema) cannot satisfy, requiring a physically separate service + datastore.
3. **Heavy or license-isolated runtime** — a workload that must not share the app's process/lifecycle:
   an AGPL-isolated process (e.g. OnePostman's OpenMontage render boundary), a GPU/ML inference service,
   a long-lived stateful engine.
4. **Org / team scaling** — independent deploy cadence across teams is the actual bottleneck (Conway's Law),
   not the code. (Rare at this fleet's size — be honest about whether this is real.)
5. **Divergent availability SLA** — one module needs an availability/latency guarantee materially different
   from the rest and coupling them drags both.

### The "DON'T escalate" list (anti-over-engineering — reject these as triggers)

- ❌ "It'll scale better someday" (premature — the monolith scales vertically + read-replicas + a worker fleet far).
- ❌ "Microservices are best practice" (they are a trade-off, not a default).
- ❌ "The code feels big" (that's a *modularity* problem — fix module boundaries inside the monolith first).
- ❌ "We want independent modules" (the RBAC feature registry + tRPC routers already give clean internal
  boundaries with zero network cost).
- ❌ A split that would produce a **distributed monolith** — services that must deploy together, share a DB,
  or call each other synchronously in a request-blocking chain. That is the worst of both worlds; do not ship it.

### Gate procedure

1. Confirm ≥1 real trigger above. Write it into `docs/PRODUCT.md` (§ Non-functional / § Deployment Config)
   and `docs/DECISIONS_LOG.md` as an explicit owner-gated `[WHAT]`.
2. Identify the **minimum** set of services (usually ONE carved context, not "all of them"). Prefer the
   selective-extraction / strangler pattern (§3) over full decomposition.
3. Only then apply §2. If the gate is not cleared, the app stays a modular monolith — full stop.

---

## §2 — Reference architecture (decompose-the-locked-stack)

The same locked stack, split by bounded context. Nothing here replaces `security.md`, `ui-rules.md`,
`cicd.md`, `rbac.md`, `notifications.md` — each service inherits them. **INHERIT-not-REPLACE.**

### 2.1 Service boundaries — derive from the domain, not the code layout
- Boundaries follow **bounded contexts**, sourced from `docs/PRODUCT.md` Modules & Features + the RBAC
  **feature registry** (the registry is already the app's module map — reuse it). One service owns one
  bounded context and its data. If two "services" always change together, they are one service.
- **Ubiquitous rule:** a service owns its data exclusively. No other service reaches into its database.

### 2.2 Service internals — keep the locked stack per service
- Each service is a **Next.js (API/route handlers) or a standalone Node/tRPC service** — keep tRPC where a
  service has its own UI or a typed internal API. tRPC's end-to-end type safety is preserved **within** a
  service; it is NOT stretched across the network as the inter-service contract (see 2.4).
- Prisma per service, scoped to that service's own schema.
- Auth.js remains the identity mechanism at the edge (2.6), not re-implemented per service.

### 2.3 Data — database-per-service, no shared tables
- **One PostgreSQL database (or schema with a hard boundary) per service.** No cross-service JOINs, no shared
  Prisma schema. Each service migrates independently (its own migration history, per `cicd.md` build-once).
- Cross-service data needs are met by **events + local read models** (2.5), never by reaching into another
  service's DB.
- **Multi-tenancy survives decomposition:** `tenant_id` is carried on every request (2.6) and stamped on
  every row in every service. Tenant isolation is enforced per service exactly as in the monolith (L3/L6).

### 2.4 Synchronous contracts — typed, versioned, thin
- Prefer **async events** (2.5) over sync calls. When a sync call is unavoidable (a query a caller needs
  *now*), use a **typed HTTP contract**: a shared `@app/contracts` package of **zod schemas** (request +
  response) that both sides import — the same validation-at-the-boundary discipline as tRPC, made explicit
  across the wire. Optionally tRPC HTTP links between TS services.
- **Version every contract.** Additive changes only within a major; breaking changes = a new versioned route.
  Treat a contract change as a fleet-wide edit (find ALL consumers — same blast-radius discipline as a shared
  type change in the monolith).
- **No request-blocking sync chains** deeper than one hop. A → B → C synchronous is a distributed-monolith
  smell; re-model as events.

### 2.5 Async / eventing — the primary integration mechanism
- **Default backbone: Valkey Streams + BullMQ** (already in the locked stack) for events + jobs. This composes
  directly with `notifications.md` (the event-delivery deliverable) — reuse its schema+versioning, tenant
  isolation, idempotency, and PII-routing rules for inter-service events too.
- **Opt-in heavier backbone: NATS JetStream** when durable, high-throughput, multi-consumer event streaming
  outgrows Valkey Streams (same opt-in already noted in `notifications.md`). Not the default.
- **Outbox pattern (mandatory for state-changing events):** write the domain change + the outbound event in
  ONE local DB transaction to an `outbox` table; a relay publishes it. Guarantees no lost/ghost events.
- **Idempotent consumers:** every consumer dedupes on an event id (at-least-once delivery is assumed).

### 2.6 Auth & tenancy propagation
- **Auth.js at the edge / gateway** authenticates once. The gateway mints a **short-lived signed token
  (JWT)** carrying `user_id`, `tenant_id`, and roles/permissions, propagated on every inter-service call.
- Services **verify the signature** (shared public key / JWKS) — they do not re-authenticate against a
  session store on every hop. A central **identity/auth service** owns issuance + refresh.
- `tenant_id` from the token is non-negotiable on every query in every service (RBAC + L6 guardrails apply
  per service, per `rbac.md` + `security.md`).

### 2.7 Gateway, routing & deployment
- **Traefik** is the API gateway / edge router (already the fleet's ingress). Routes public traffic to
  services by path/host; terminates TLS; applies rate-limits at the edge.
- **Komodo** orchestrates one Docker Compose **stack per service** (each service = its own build-once image,
  its own deploy lifecycle, per `cicd.md`). CI builds each service image once and promotes the SAME bytes
  dev → staging → prod (Rule 36). Rollback couples each service's image tag to its own schema migration.
- **No service mesh by default** (see §4). Traefik + signed tokens + mTLS-where-needed covers this fleet.

### 2.8 Observability (mandatory once distributed)
- **OpenTelemetry** traces + metrics per service; **correlation/trace id** propagated through the gateway and
  every event so a single user action is traceable across services.
- Structured logs with `tenant_id` + `trace_id`. Per-service health endpoints (Traefik healthchecks).
- (Infra-level monitoring/alerting is owned by the separate Server-Setups framework, not app deploy —
  same boundary as the monolith.)

### 2.9 Inter-service security
- **mTLS** between services on the internal network, OR signed-token verification (2.6) as the minimum.
- Every service applies the full **L1–L6** stack + the relevant **Security_Checklist** sections
  (esp. §16 API authorization depth + injection, §21 tenant RBAC) — decomposition multiplies the attack
  surface, so each service is hardened as if internet-facing.

---

## §3 — Migration path: strangler out of the monolith (never big-bang)

When an existing modular monolith clears the §1 gate, extract **one** bounded context at a time:

1. **Pick the highest-value / most-isolated context** (usually the trigger workload itself).
2. **Draw the seam inside the monolith first** — make that context's module talk to the rest ONLY through a
   clean interface (tRPC router boundary + events). If it can't be cleanly seam'd in-process, it can't be a
   service yet — fix the internal boundary first.
3. **Stand up the new service** (2.2–2.9) with its own DB; **dual-write / event-sync** to migrate its data.
4. **Route through the seam:** the gateway sends that context's traffic to the new service; the monolith calls
   it via the typed contract/events instead of the in-process module.
5. **Delete the old module** from the monolith once the service is verified (Playwright verify-all-pages +
   the whole-suite regression gate across the blast radius — `branch-commit-discipline`).
6. **Repeat only if a further trigger justifies it.** Stop as soon as the trigger is satisfied — a
   monolith-core + a few carved services is a perfectly good, often *optimal*, end state.

The monolith is never fully dissolved "on principle." You extract exactly what the trigger demands.

---

## §4 — What we deliberately DON'T do

- **No default service mesh** (Istio/Linkerd). Traefik + signed tokens + mTLS-where-needed is enough at this
  fleet's scale; a mesh is its own ops product.
- **No polyglot sprawl.** Stay on the locked stack (TS/Next.js/tRPC/Prisma/Postgres/Valkey) unless a trigger
  *specifically* demands another runtime (e.g. a Python ML service) — and then only that one service.
- **No premature decomposition.** Modularity problems are solved inside the monolith first (module boundaries,
  the RBAC registry, tRPC routers). Split only on a real §1 trigger.
- **No distributed monolith.** Services that deploy together, share a DB, or form synchronous request-blocking
  chains are a failure — re-model or don't split.
- **No event sourcing / CQRS by default.** Use them only where a specific service's domain clearly benefits;
  they are not the fleet baseline.

---

## §5 — Pre-ship gates (before any decomposed service goes past LOCAL)

- [ ] §1 escalation gate cleared + recorded (`PRODUCT.md` + `DECISIONS_LOG.md`, owner-gated `[WHAT]`).
- [ ] Each service owns its data (no shared DB / cross-service JOIN). `tenant_id` enforced per service.
- [ ] Cross-service integration is event-first; every state-changing event uses the outbox; consumers idempotent.
- [ ] All sync contracts typed + versioned (`@app/contracts` zod); no >1-hop request-blocking chains.
- [ ] Auth: edge Auth.js → signed token with `tenant_id`; services verify signature; identity service owns issuance.
- [ ] Each service: L1–L6 + Security_Checklist §16/§21; mTLS or signed-token inter-service auth.
- [ ] Per-service CI build-once + coupled image↔migration rollback (`cicd.md` Rule 36).
- [ ] OpenTelemetry tracing + correlation ids across gateway + events.
- [ ] Whole-blast-radius regression gate green (Playwright verify-all-pages + full suite) after each strangler step.
- [ ] HARD HOLD respected — LOCAL only; staging/prod/demo promotion is a separate owner decision.

---

*Rule 37 · Scenario 47 · deliverable #33. Default posture stays the modular monolith; this file governs the
owner-gated exception. INHERIT-not-REPLACE over the locked stack — it composes with `security.md`,
`ui-rules.md`, `cicd.md`, `rbac.md`, `notifications.md`, never overrides them.*
