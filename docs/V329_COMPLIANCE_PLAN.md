# V32.9 Compliance & Data Privacy — Implementation Plan

Branch: `feat/v329-compliance-features` (off `chore/framework-sync-v329-wcag`)
Authority: `.ai_prompt/privacy.md` (PH Data Privacy Act RA 10173 / NPC; WCAG 2.2 AA)

## Established patterns (verified)
- Multi-tenancy: schema-per-tenant; new global/admin models need `@@schema("public")`, `@map` snake_case.
- tRPC: `createTRPCRouter`, `protectedProcedure`, `writeProcedure` (demo-block), `platformProcedure`, `requireRole(...)`. Tenant scope via `ctx.tenantId`/`ctx.userId` from session (never input). Root router = `apps/web/src/server/trpc/routers/_app.ts`. Audit via existing `AuditLog` model.
- Prisma: models String enums (not native), `prisma migrate dev` (dev pg healthy). schema at `packages/db/prisma/schema.prisma`.
- UI: shadcn theme tokens; pages under `apps/web/src/app/(tenant)/[slug]/(app)/...`; public pages at `apps/web/src/app/...`. Landing = `src/app/page.tsx`. Root layout = `src/app/layout.tsx`.

## Scope (this session)
### A. Prisma models (create-only migration `20260620000000_add_compliance_privacy`)
- `DataSubjectRequest` (public schema): id, tenantId, userId (subject), type (access|rectify|erase|port|object|inform), status (received|in_progress|completed|rejected), details Json?, resolution String?, handledById?, createdAt, resolvedAt. Indexes tenantId, userId, status.
- `BreachRecord` (public schema): id, tenantId, title, description, discoveredAt, severity (low|medium|high|critical), affectedSubjects Int?, npcNotifiedAt?, subjectsNotifiedAt?, fullReportDueAt (discoveredAt+5 business days, computed), fullReportFiledAt?, status (open|notified|reported|closed), reportedById, createdAt, updatedAt. Indexes tenantId, status.

### B. tRPC `dsrRouter` (dsr.*) — subject self-service + admin handling
- dsr.inform (protected): returns current privacy notice metadata + lawful bases.
- dsr.access (protected): machine-readable copy of subject's own User + Employee + AuditLog (tenantId-scoped, tenantId omitted from response).
- dsr.rectify (writeProcedure): patch own User profile fields (firstName,lastName,displayName,phone).
- dsr.port (protected): structured JSON export of own data.
- dsr.requestErasure (writeProcedure): create DataSubjectRequest(type=erase) — does NOT hard-delete (legal retention for ERP/payroll). Admin reviews.
- dsr.object (writeProcedure): create DataSubjectRequest(type=object).
- admin sub-router (requireRole admin): list/byId/updateStatus DSRs. All audited.

### C. tRPC `breachRouter` (compliance.breach.*) — admin only (requireRole)
- list / byId / create / update / markNpcNotified / markSubjectsNotified / fileReport / close. Audited.

### D. UI
- Public privacy page: `src/app/privacy/page.tsx` (+ honest notice content; DPO contact bonitobonita24@gmail.com — FLAGGED assumption).
- ComplianceFooter component: `src/components/compliance-footer.tsx` — configurable; design-claims ON (built with security-by-default, PH DPA-aligned), cert badges OFF. Wire into landing page + privacy page.
- DSR self-service page (tenant app): `.../(app)/privacy/page.tsx` — view my data / export / request correction / request erasure.
- Breach admin page: `.../(app)/settings/breach/page.tsx` (admin role).

### E. WCAG 2.2 AA quick wins
- Audit key flows (login, landing, privacy). Fix clear violations (labels, contrast tokens, focus, touch targets). Log remainder.

## Rule-1 assumptions (back-ported to DECISIONS_LOG.md)
- Controller = Powerbyte IT Solutions.
- DPO contact = bonitobonita24@gmail.com.
- Lawful basis (HR/employee PII) = contract + legitimate interest.
- Erasure for ERP/payroll/banking data = request-and-review (legal retention), NOT immediate hard-delete.

## Gate
pnpm typecheck / lint / test / build (turbo). Bust cache with --force on suspicion.
