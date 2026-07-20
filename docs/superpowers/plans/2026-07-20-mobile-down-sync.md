# Mobile Down-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull `tasks` and `payslips` from the server onto the phone, so the two currently-dead mobile screens show real data.

**Architecture:** Two new REST `GET` endpoints under `/api/sync/*` mirror the existing up-sync middleware chain (bearer auth → rate limit → RBAC matrix → tenant-scoped query). The mobile client full-replaces its local WatermelonDB tables from those responses, skipping any row with an unsynced local edit. Pull is driven by the existing 30s auto-sync tick (push first, then pull), plus pull-to-refresh and app-foreground.

**Tech Stack:** Next.js Route Handlers · Prisma · Vitest · React Native / Expo · WatermelonDB

**Spec:** `docs/superpowers/specs/2026-07-20-mobile-down-sync-design.md`

## Global Constraints

- **HARD HOLD — local commits only.** Never push, never deploy to staging/prod/demo. (`~/.claude/rules/deploy-discipline.md`)
- **TypeScript strict.** No `any`, no non-null assertions to silence the compiler. (Rule 12)
- **Tenant isolation is non-negotiable.** Every Prisma query in this plan filters on `tenantId` from the server-resolved bearer context — never from the request body. (Rule 7, `security.md`)
- **Payslips are financial PII.** Queries bind to the requesting user's own employee record in addition to tenant scoping.
- **No schema migration.** Do not modify `packages/db/prisma/schema.prisma`. Do not bump the WatermelonDB `appSchema` version — every column used already exists.
- **Never hand-roll skeletons.** Loading states follow `ui-rules.md` Rule 11 (not applicable to this plan's UI edits, which only add `RefreshControl`).
- Commit after every task. Conventional commit format (`feat(...)`, `test(...)`, `chore(...)`).

---

### Task 1: Pull serializers (pure functions)

Server → mobile column mapping lives in one tested place. These are pure functions with **no Prisma import** — they take structural types, so they test without a database.

**Files:**
- Create: `apps/web/src/server/sync/serializers/pull.ts`
- Test: `apps/web/src/server/sync/serializers/__tests__/pull.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `serializeTaskForPull(task: TaskPullSource, userId: string): PulledTask`
  - `serializePayslipForPull(payslip: PayslipPullSource, userId: string): PulledPayslip`
  - types `PulledTask`, `PulledPayslip`, `TaskPullSource`, `PayslipPullSource`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/server/sync/serializers/__tests__/pull.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { serializeTaskForPull, serializePayslipForPull } from "../pull";

describe("serializeTaskForPull", () => {
  const task = {
    id: "task-1",
    tenantId: "tenant-1",
    title: "Fix the pump",
    description: "North wellhead",
    status: "in_progress",
    priority: "high",
    dueDate: new Date("2026-08-01T00:00:00.000Z"),
    projectId: "proj-1",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
  };

  it("maps server fields onto the mobile column shape", () => {
    expect(serializeTaskForPull(task, "user-1")).toEqual({
      server_id: "task-1",
      tenant_id: "tenant-1",
      title: "Fix the pump",
      description: "North wellhead",
      status: "in_progress",
      priority: "high",
      assigned_to: "user-1",
      due_date: Date.UTC(2026, 7, 1),
      project_id: "proj-1",
      created_at: Date.UTC(2026, 6, 1),
      updated_at: Date.UTC(2026, 6, 15),
      synced: true,
    });
  });

  it("passes through a null dueDate", () => {
    const result = serializeTaskForPull({ ...task, dueDate: null }, "user-1");
    expect(result.due_date).toBeNull();
  });
});

describe("serializePayslipForPull", () => {
  const payslip = {
    id: "slip-1",
    tenantId: "tenant-1",
    grossPay: { toNumber: () => 50000, toFixed: (n: number) => (50000).toFixed(n) },
    netPay: { toNumber: () => 42000, toFixed: (n: number) => (42000).toFixed(n) },
    totalDeductions: { toNumber: () => 8000, toFixed: (n: number) => (8000).toFixed(n) },
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-02T00:00:00.000Z"),
    payroll: {
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-15T00:00:00.000Z"),
    },
  };

  it("maps the period from the joined payroll and stringifies deductions", () => {
    expect(serializePayslipForPull(payslip, "user-1")).toEqual({
      server_id: "slip-1",
      tenant_id: "tenant-1",
      user_id: "user-1",
      period_start: Date.UTC(2026, 5, 1),
      period_end: Date.UTC(2026, 5, 15),
      gross_pay: 50000,
      net_pay: 42000,
      deductions: "8000.00",
      created_at: Date.UTC(2026, 6, 1),
      updated_at: Date.UTC(2026, 6, 2),
    });
  });

  it("emits deductions as a parseFloat-able string (the mobile screen calls parseFloat)", () => {
    const result = serializePayslipForPull(payslip, "user-1");
    expect(Number.isNaN(parseFloat(result.deductions))).toBe(false);
    expect(parseFloat(result.deductions)).toBe(8000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @orqafy/web test src/server/sync/serializers`
Expected: FAIL — `Failed to resolve import "../pull"`

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/server/sync/serializers/pull.ts`:

```ts
/**
 * Server → mobile column-shape serializers for the down-sync (pull) endpoints.
 *
 * These take STRUCTURAL types rather than Prisma model types on purpose: the
 * mapping is the contract the mobile WatermelonDB tables depend on, and keeping
 * it Prisma-free means it is unit-testable without a database and cannot drift
 * silently when a Prisma type changes shape.
 *
 * Column names are snake_case and dates are epoch-ms because that is exactly
 * what WatermelonDB's appSchema declares (apps/mobile/src/storage/schema.ts).
 */

/** Minimal Prisma Decimal surface we rely on. */
interface DecimalLike {
  toNumber(): number;
  toFixed(digits: number): string;
}

export interface TaskPullSource {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PulledTask {
  server_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string;
  due_date: number | null;
  project_id: string | null;
  created_at: number;
  updated_at: number;
  synced: true;
}

export function serializeTaskForPull(task: TaskPullSource, userId: string): PulledTask {
  return {
    server_id: task.id,
    tenant_id: task.tenantId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    // The mobile table holds a single scalar assignee. The result set is already
    // filtered to tasks assigned to THIS user, so this is exact for this view.
    assigned_to: userId,
    due_date: task.dueDate?.getTime() ?? null,
    project_id: task.projectId,
    created_at: task.createdAt.getTime(),
    updated_at: task.updatedAt.getTime(),
    // Server-sourced rows are, by definition, in sync.
    synced: true,
  };
}

export interface PayslipPullSource {
  id: string;
  tenantId: string;
  grossPay: DecimalLike;
  netPay: DecimalLike;
  totalDeductions: DecimalLike;
  createdAt: Date;
  updatedAt: Date;
  payroll: {
    periodStart: Date;
    periodEnd: Date;
  };
}

export interface PulledPayslip {
  server_id: string;
  tenant_id: string;
  user_id: string;
  period_start: number;
  period_end: number;
  gross_pay: number;
  net_pay: number;
  deductions: string;
  created_at: number;
  updated_at: number;
}

export function serializePayslipForPull(
  payslip: PayslipPullSource,
  userId: string,
): PulledPayslip {
  return {
    server_id: payslip.id,
    tenant_id: payslip.tenantId,
    user_id: userId,
    // Payslip has no period of its own — it lives on the joined Payroll.
    period_start: payslip.payroll.periodStart.getTime(),
    period_end: payslip.payroll.periodEnd.getTime(),
    gross_pay: payslip.grossPay.toNumber(),
    net_pay: payslip.netPay.toNumber(),
    // The mobile column is a STRING and the screen calls parseFloat() on it.
    // Emitting JSON here would render NaN. Employer shares are excluded —
    // they are employer cost, not an employee deduction.
    deductions: payslip.totalDeductions.toFixed(2),
    created_at: payslip.createdAt.getTime(),
    updated_at: payslip.updatedAt.getTime(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @orqafy/web test src/server/sync/serializers`
Expected: PASS — 4 tests

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm --filter @orqafy/web typecheck
git add apps/web/src/server/sync/serializers/
git commit -m "feat(sync): pull serializers mapping tasks/payslips to mobile column shape"
```

---

### Task 2: `GET /api/sync/tasks`

**Files:**
- Create: `apps/web/src/app/api/sync/tasks/route.ts`
- Test: `apps/web/src/app/api/sync/tasks/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `serializeTaskForPull` from Task 1
- Produces: `GET` handler returning `200 { records: PulledTask[]; serverTime: string }`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/api/sync/tasks/__tests__/route.test.ts`:

```ts
// route.test.ts — GET /api/sync/tasks (down-sync pull)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockResolveSyncBearerContext,
  mockRateLimitCheck,
  mockCheckMatrixGrant,
  mockTaskFindMany,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockResolveSyncBearerContext: vi.fn(),
  mockRateLimitCheck: vi.fn(),
  mockCheckMatrixGrant: vi.fn(),
  mockTaskFindMany: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@/server/sync/bearer-context", () => ({
  resolveSyncBearerContext: mockResolveSyncBearerContext,
}));
vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { mobile_sync: { check: mockRateLimitCheck } },
}));
vi.mock("@/server/sync/matrix-check", () => ({
  checkMatrixGrant: mockCheckMatrixGrant,
}));
vi.mock("@orqafy/db", () => ({
  prisma: { task: { findMany: mockTaskFindMany } },
}));
vi.mock("@/lib/logger", () => ({ logger: { error: mockLoggerError } }));

import { GET } from "../route";
import { TRPCError } from "@trpc/server";

const BEARER_CTX = {
  userId: "user-1",
  tenantId: "tenant-1",
  tenantSlug: "acme",
  roleId: "role-1",
  roles: ["Operator"],
  isDemoTenant: false,
};

const TASK_ROW = {
  id: "task-1",
  tenantId: "tenant-1",
  title: "Fix the pump",
  description: null,
  status: "todo",
  priority: "high",
  dueDate: null,
  projectId: "proj-1",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
};

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/sync/tasks", { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveSyncBearerContext.mockResolvedValue(BEARER_CTX);
  mockRateLimitCheck.mockReturnValue(undefined);
  mockCheckMatrixGrant.mockResolvedValue(true);
  mockTaskFindMany.mockResolvedValue([]);
});

describe("GET /api/sync/tasks", () => {
  it("returns a generic 401 when bearer auth fails", async () => {
    mockResolveSyncBearerContext.mockResolvedValueOnce(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockTaskFindMany).not.toHaveBeenCalled();
  });

  it("returns a generic 500 when bearer resolution throws unexpectedly", async () => {
    mockResolveSyncBearerContext.mockRejectedValueOnce(new Error("db exploded: secret detail"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toMatch(/db exploded/);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    mockRateLimitCheck.mockImplementationOnce(() => {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "slow down" });
    });
    expect((await GET(makeRequest())).status).toBe(429);
  });

  it("returns 403 when the RBAC matrix denies tasks:view", async () => {
    mockCheckMatrixGrant.mockResolvedValueOnce(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockTaskFindMany).not.toHaveBeenCalled();
  });

  it("scopes the query to the caller's tenant AND their own assignments", async () => {
    await GET(makeRequest());
    expect(mockTaskFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        assignments: { some: { userId: "user-1" } },
      },
    });
    expect(mockCheckMatrixGrant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      roleId: "role-1",
      feature: "tasks",
      action: "view",
    });
  });

  it("returns 200 with serialized records and a serverTime", async () => {
    mockTaskFindMany.mockResolvedValueOnce([TASK_ROW]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      records: Array<Record<string, unknown>>;
      serverTime: string;
    };
    expect(body.records).toHaveLength(1);
    expect(body.records[0]).toMatchObject({
      server_id: "task-1",
      tenant_id: "tenant-1",
      assigned_to: "user-1",
      synced: true,
    });
    expect(Number.isNaN(Date.parse(body.serverTime))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @orqafy/web test src/app/api/sync/tasks`
Expected: FAIL — `Failed to resolve import "../route"`

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/api/sync/tasks/route.ts`:

```ts
// Non-tRPC: manual auth required (security.md L11) — read-only DOWN-SYNC
// endpoint feeding the mobile Tasks screen. Mirrors the security posture of
// /api/sync/[entityType]/route.ts and /api/sync/expense-categories/route.ts:
//   - Manual bearer auth via resolveSyncBearerContext (tRPC bypassed).
//   - RBAC via the SAME `tasks` matrix feature the web tRPC surface uses.
//   - Rate-limited via the `mobile_sync` tier, keyed by userId (post-auth).
//   - Tenant-scoped AND restricted to the caller's own assignments.
//   - No demo-tenant guard — this is a read, not a write.
import { type NextRequest, NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { prisma } from "@orqafy/db";

import { resolveSyncBearerContext } from "@/server/sync/bearer-context";
import { checkMatrixGrant } from "@/server/sync/matrix-check";
import { rateLimiters } from "@/server/lib/rate-limit";
import { logger } from "@/lib/logger";
import { serializeTaskForPull } from "@/server/sync/serializers/pull";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Auth — generic-401 contract, no enumeration surface.
  let bearer;
  try {
    bearer = await resolveSyncBearerContext(req);
  } catch (err) {
    logger.error({ err }, "mobile-sync: unexpected auth error (tasks pull)");
    return jsonError(500, "Something went wrong. Please try again.");
  }
  if (bearer === null) {
    return jsonError(401, "Unauthorized");
  }

  // 2. Rate limit — keyed by a real userId, not a spoofable header.
  try {
    rateLimiters.mobile_sync.check(bearer.userId);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS") {
      return jsonError(429, "Too many requests. Try again later.");
    }
    throw err;
  }

  // 3. RBAC — same matrix feature/action the web tasks list uses.
  const allowed = await checkMatrixGrant({
    tenantId: bearer.tenantId,
    roleId: bearer.roleId,
    feature: "tasks",
    action: "view",
  });
  if (!allowed) {
    return jsonError(403, "Access denied.");
  }

  // 4. Tenant-scoped + assigned-to-me. Task has no `assignedTo` scalar;
  //    assignment lives in the TaskAssignment join table.
  const tasks = await prisma.task.findMany({
    where: {
      tenantId: bearer.tenantId,
      assignments: { some: { userId: bearer.userId } },
    },
  });

  return NextResponse.json({
    records: tasks.map((task) => serializeTaskForPull(task, bearer.userId)),
    serverTime: new Date().toISOString(),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @orqafy/web test src/app/api/sync/tasks`
Expected: PASS — 6 tests

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm --filter @orqafy/web typecheck
git add apps/web/src/app/api/sync/tasks/
git commit -m "feat(sync): GET /api/sync/tasks down-sync endpoint (assigned-to-me, tenant-scoped)"
```

---

### Task 3: `GET /api/sync/payslips`

Same chain as Task 2, but the query joins `Payroll` for the period and binds to the caller's own `Employee`.

**Files:**
- Create: `apps/web/src/app/api/sync/payslips/route.ts`
- Test: `apps/web/src/app/api/sync/payslips/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `serializePayslipForPull` from Task 1
- Produces: `GET` handler returning `200 { records: PulledPayslip[]; serverTime: string }`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/api/sync/payslips/__tests__/route.test.ts`:

```ts
// route.test.ts — GET /api/sync/payslips (down-sync pull)
// Payslips are financial PII: tenant scoping alone is NOT sufficient, the query
// must also bind to the caller's own employee record.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockResolveSyncBearerContext,
  mockRateLimitCheck,
  mockCheckMatrixGrant,
  mockPayslipFindMany,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockResolveSyncBearerContext: vi.fn(),
  mockRateLimitCheck: vi.fn(),
  mockCheckMatrixGrant: vi.fn(),
  mockPayslipFindMany: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@/server/sync/bearer-context", () => ({
  resolveSyncBearerContext: mockResolveSyncBearerContext,
}));
vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { mobile_sync: { check: mockRateLimitCheck } },
}));
vi.mock("@/server/sync/matrix-check", () => ({
  checkMatrixGrant: mockCheckMatrixGrant,
}));
vi.mock("@orqafy/db", () => ({
  prisma: { payslip: { findMany: mockPayslipFindMany } },
}));
vi.mock("@/lib/logger", () => ({ logger: { error: mockLoggerError } }));

import { GET } from "../route";
import { TRPCError } from "@trpc/server";

const BEARER_CTX = {
  userId: "user-1",
  tenantId: "tenant-1",
  tenantSlug: "acme",
  roleId: "role-1",
  roles: ["Operator"],
  isDemoTenant: false,
};

function decimal(value: number) {
  return { toNumber: () => value, toFixed: (n: number) => value.toFixed(n) };
}

const PAYSLIP_ROW = {
  id: "slip-1",
  tenantId: "tenant-1",
  grossPay: decimal(50000),
  netPay: decimal(42000),
  totalDeductions: decimal(8000),
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  payroll: {
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-06-15T00:00:00.000Z"),
  },
};

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/sync/payslips", { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveSyncBearerContext.mockResolvedValue(BEARER_CTX);
  mockRateLimitCheck.mockReturnValue(undefined);
  mockCheckMatrixGrant.mockResolvedValue(true);
  mockPayslipFindMany.mockResolvedValue([]);
});

describe("GET /api/sync/payslips", () => {
  it("returns a generic 401 when bearer auth fails", async () => {
    mockResolveSyncBearerContext.mockResolvedValueOnce(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockPayslipFindMany).not.toHaveBeenCalled();
  });

  it("returns a generic 500 when bearer resolution throws unexpectedly", async () => {
    mockResolveSyncBearerContext.mockRejectedValueOnce(new Error("db exploded: secret detail"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toMatch(/db exploded/);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    mockRateLimitCheck.mockImplementationOnce(() => {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "slow down" });
    });
    expect((await GET(makeRequest())).status).toBe(429);
  });

  it("returns 403 when the RBAC matrix denies payroll:view", async () => {
    mockCheckMatrixGrant.mockResolvedValueOnce(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockPayslipFindMany).not.toHaveBeenCalled();
  });

  it("binds the query to the caller's tenant AND their own employee record (PII/IDOR guard)", async () => {
    await GET(makeRequest());
    expect(mockPayslipFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        employee: { userId: "user-1" },
        payroll: { status: { in: ["approved", "paid"] } },
      },
      include: { payroll: true },
    });
    expect(mockCheckMatrixGrant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      roleId: "role-1",
      feature: "payroll",
      action: "view",
    });
  });

  it("returns 200 with serialized records including the joined period", async () => {
    mockPayslipFindMany.mockResolvedValueOnce([PAYSLIP_ROW]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      records: Array<Record<string, unknown>>;
      serverTime: string;
    };
    expect(body.records[0]).toMatchObject({
      server_id: "slip-1",
      user_id: "user-1",
      period_start: Date.UTC(2026, 5, 1),
      period_end: Date.UTC(2026, 5, 15),
      gross_pay: 50000,
      net_pay: 42000,
      deductions: "8000.00",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @orqafy/web test src/app/api/sync/payslips`
Expected: FAIL — `Failed to resolve import "../route"`

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/api/sync/payslips/route.ts`:

```ts
// Non-tRPC: manual auth required (security.md L11) — read-only DOWN-SYNC
// endpoint feeding the mobile Payslips screen.
//
// PII NOTE: payslips are financial personal data. Tenant scoping ALONE is not
// sufficient — the query is additionally bound to the caller's own Employee
// record (Employee.userId is @unique), so a worker can never read a colleague's
// payslip within the same tenant. Draft payrolls are excluded: a worker must not
// see a payslip that is still being computed.
import { type NextRequest, NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { prisma } from "@orqafy/db";

import { resolveSyncBearerContext } from "@/server/sync/bearer-context";
import { checkMatrixGrant } from "@/server/sync/matrix-check";
import { rateLimiters } from "@/server/lib/rate-limit";
import { logger } from "@/lib/logger";
import { serializePayslipForPull } from "@/server/sync/serializers/pull";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Payroll states whose payslips are final enough to show a worker. */
const RELEASED_PAYROLL_STATUSES = ["approved", "paid"];

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Auth
  let bearer;
  try {
    bearer = await resolveSyncBearerContext(req);
  } catch (err) {
    logger.error({ err }, "mobile-sync: unexpected auth error (payslips pull)");
    return jsonError(500, "Something went wrong. Please try again.");
  }
  if (bearer === null) {
    return jsonError(401, "Unauthorized");
  }

  // 2. Rate limit
  try {
    rateLimiters.mobile_sync.check(bearer.userId);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS") {
      return jsonError(429, "Too many requests. Try again later.");
    }
    throw err;
  }

  // 3. RBAC
  const allowed = await checkMatrixGrant({
    tenantId: bearer.tenantId,
    roleId: bearer.roleId,
    feature: "payroll",
    action: "view",
  });
  if (!allowed) {
    return jsonError(403, "Access denied.");
  }

  // 4. Tenant-scoped + own-employee-only + released payrolls only.
  //    The period lives on Payroll, so it must be joined.
  const payslips = await prisma.payslip.findMany({
    where: {
      tenantId: bearer.tenantId,
      employee: { userId: bearer.userId },
      payroll: { status: { in: RELEASED_PAYROLL_STATUSES } },
    },
    include: { payroll: true },
  });

  return NextResponse.json({
    records: payslips.map((slip) => serializePayslipForPull(slip, bearer.userId)),
    serverTime: new Date().toISOString(),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @orqafy/web test src/app/api/sync/payslips`
Expected: PASS — 6 tests

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm --filter @orqafy/web typecheck
git add apps/web/src/app/api/sync/payslips/
git commit -m "feat(sync): GET /api/sync/payslips down-sync endpoint (own-employee PII guard, released payrolls only)"
```

---

### Task 4: Mobile test runner + pure `reconcile`

`apps/mobile` currently has **no test runner** (no vitest/jest config, no `test` script, zero tests). `reconcile` can permanently destroy a worker's local rows, so it must be tested. This task adds a minimal Vitest setup.

`reconcile` lives in its own file with **zero imports** — no React Native, no WatermelonDB — so it runs under plain Vitest with no RN transform configuration.

**Files:**
- Modify: `apps/mobile/package.json` (add `test` script + devDependency)
- Create: `apps/mobile/vitest.config.ts`
- Create: `apps/mobile/src/sync/reconcile.ts`
- Test: `apps/mobile/src/sync/__tests__/reconcile.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `reconcile<S, L>(serverRows, localRows, opts): ReconcilePlan<S, L>` with
    `opts = { serverKey, localKey, hasPendingWrites }`, returning
    `{ toCreate: S[]; toUpdate: Array<{ local: L; server: S }>; toDestroy: L[]; skipped: L[] }`
  - `assertRecords<T>(body): T[]` — throws on a malformed body. It lives here (not in
    `pull.ts`) specifically so it is testable: `pull.ts` imports WatermelonDB and cannot run
    under this node-env config, and this guard is what stops a bad response from wiping the
    local table.

- [ ] **Step 1: Add the Vitest setup**

```bash
pnpm --filter @orqafy/mobile add -D vitest
```

Create `apps/mobile/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

/**
 * Minimal Vitest config for PURE logic in the mobile package (no React Native
 * runtime). Only files that import nothing from react-native / watermelondb can
 * be tested here — currently the sync reconcile planner, whose correctness
 * matters because a wrong plan can permanently destroy local rows.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
```

Add to `apps/mobile/package.json` `scripts`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/src/sync/__tests__/reconcile.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { reconcile, assertRecords } from "../reconcile";

interface ServerRow {
  server_id: string;
  title: string;
}
interface LocalRow {
  serverId: string;
  title: string;
  synced: boolean;
}

const opts = {
  serverKey: (r: ServerRow) => r.server_id,
  localKey: (r: LocalRow) => r.serverId,
  hasPendingWrites: (r: LocalRow) => !r.synced,
};

describe("reconcile", () => {
  it("creates server rows that have no local counterpart", () => {
    const plan = reconcile<ServerRow, LocalRow>(
      [{ server_id: "a", title: "A" }],
      [],
      opts,
    );
    expect(plan.toCreate).toEqual([{ server_id: "a", title: "A" }]);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDestroy).toHaveLength(0);
  });

  it("updates rows present both locally and on the server", () => {
    const local = { serverId: "a", title: "old", synced: true };
    const plan = reconcile<ServerRow, LocalRow>(
      [{ server_id: "a", title: "new" }],
      [local],
      opts,
    );
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toEqual([{ local, server: { server_id: "a", title: "new" } }]);
  });

  it("destroys synced local rows the server no longer returns", () => {
    const gone = { serverId: "gone", title: "Reassigned away", synced: true };
    const plan = reconcile<ServerRow, LocalRow>([], [gone], opts);
    expect(plan.toDestroy).toEqual([gone]);
  });

  it("SKIPS a server row whose local counterpart has pending writes", () => {
    const pending = { serverId: "a", title: "in_progress locally", synced: false };
    const plan = reconcile<ServerRow, LocalRow>(
      [{ server_id: "a", title: "todo on server" }],
      [pending],
      opts,
    );
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.skipped).toEqual([pending]);
  });

  it("NEVER destroys a local row with pending writes, even if absent from the server", () => {
    const pendingOnly = { serverId: "a", title: "unsynced work", synced: false };
    const plan = reconcile<ServerRow, LocalRow>([], [pendingOnly], opts);
    expect(plan.toDestroy).toHaveLength(0);
  });

  it("treats every row as server-wins when hasPendingWrites is always false (payslips)", () => {
    const local = { serverId: "a", title: "old", synced: false };
    const plan = reconcile<ServerRow, LocalRow>(
      [{ server_id: "a", title: "new" }],
      [local],
      { ...opts, hasPendingWrites: () => false },
    );
    expect(plan.skipped).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(1);
  });

  it("produces an empty plan for empty input on both sides", () => {
    const plan = reconcile<ServerRow, LocalRow>([], [], opts);
    expect(plan).toEqual({ toCreate: [], toUpdate: [], toDestroy: [], skipped: [] });
  });
});

describe("assertRecords", () => {
  it("returns the records array from a well-formed body", () => {
    expect(assertRecords({ records: [{ a: 1 }], serverTime: "x" })).toEqual([{ a: 1 }]);
  });

  it("accepts a legitimately empty record set", () => {
    expect(assertRecords({ records: [], serverTime: "x" })).toEqual([]);
  });

  // These are the cases that would otherwise wipe the local table under
  // full-replace semantics: a malformed body must NEVER read as "no records".
  it("throws on a null body", () => {
    expect(() => assertRecords(null)).toThrow(/malformed/);
  });

  it("throws on an undefined body", () => {
    expect(() => assertRecords(undefined)).toThrow(/malformed/);
  });

  it("throws when records is missing", () => {
    expect(() => assertRecords({ serverTime: "x" } as never)).toThrow(/malformed/);
  });

  it("throws when records is not an array", () => {
    expect(() => assertRecords({ records: "nope", serverTime: "x" } as never)).toThrow(
      /malformed/,
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @orqafy/mobile test`
Expected: FAIL — `Failed to resolve import "../reconcile"`

- [ ] **Step 4: Write the implementation**

Create `apps/mobile/src/sync/reconcile.ts`:

```ts
/**
 * Pure full-replace reconciliation planner for the down-sync (pull).
 *
 * Deliberately dependency-free — no react-native, no watermelondb — so it is
 * unit-testable under plain Vitest. It DECIDES what should happen; applying the
 * plan to the database is the caller's job (pull.ts). That split matters: a bug
 * here can permanently destroy a worker's local rows.
 *
 * Governing rule (spec §3):
 *   Up-sync owns rows with pending local writes. The server owns everything else.
 */

export interface ReconcileOptions<S, L> {
  /** Extract the server-side id from a server row. */
  serverKey: (row: S) => string;
  /** Extract the server-side id from a local row. */
  localKey: (row: L) => string;
  /**
   * True when the local row has an edit that has not yet been pushed. Such rows
   * are never overwritten and never destroyed.
   *   tasks    → (row) => row.synced === false
   *   payslips → () => false   (phone never writes payslips)
   */
  hasPendingWrites: (row: L) => boolean;
}

export interface ReconcilePlan<S, L> {
  toCreate: S[];
  toUpdate: Array<{ local: L; server: S }>;
  toDestroy: L[];
  skipped: L[];
}

export function reconcile<S, L>(
  serverRows: S[],
  localRows: L[],
  { serverKey, localKey, hasPendingWrites }: ReconcileOptions<S, L>,
): ReconcilePlan<S, L> {
  const plan: ReconcilePlan<S, L> = {
    toCreate: [],
    toUpdate: [],
    toDestroy: [],
    skipped: [],
  };

  const localByKey = new Map<string, L>();
  for (const local of localRows) {
    localByKey.set(localKey(local), local);
  }

  const seenKeys = new Set<string>();

  for (const server of serverRows) {
    const key = serverKey(server);
    seenKeys.add(key);
    const local = localByKey.get(key);

    if (local === undefined) {
      plan.toCreate.push(server);
    } else if (hasPendingWrites(local)) {
      // Pending up-sync wins — leave it alone until its queued op lands.
      plan.skipped.push(local);
    } else {
      plan.toUpdate.push({ local, server });
    }
  }

  for (const local of localRows) {
    if (seenKeys.has(localKey(local))) continue;
    // Absent from the server set. Destroy it UNLESS it holds unpushed work.
    if (hasPendingWrites(local)) continue;
    plan.toDestroy.push(local);
  }

  return plan;
}

export interface PullResponse<T> {
  records: T[];
  serverTime: string;
}

/**
 * Validates a pull response before any reconciliation happens.
 *
 * This is the single most safety-critical guard in the down-sync: under
 * full-replace semantics, a malformed body silently read as "zero records"
 * would destroy every local row. Throwing here aborts the pull and leaves local
 * data untouched. Lives in this dependency-free module so it stays testable.
 */
export function assertRecords<T>(body: PullResponse<T> | null | undefined): T[] {
  if (body === null || body === undefined || !Array.isArray(body.records)) {
    throw new Error("pull: malformed response body");
  }
  return body.records;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @orqafy/mobile test`
Expected: PASS — 13 tests (7 reconcile + 6 assertRecords)

- [ ] **Step 6: Typecheck, lint and commit**

```bash
pnpm --filter @orqafy/mobile typecheck
pnpm --filter @orqafy/mobile lint
git add apps/mobile/package.json apps/mobile/vitest.config.ts apps/mobile/src/sync/reconcile.ts apps/mobile/src/sync/__tests__/ pnpm-lock.yaml
git commit -m "feat(mobile): pure reconcile planner for down-sync + Vitest setup for pure logic"
```

---

### Task 5: Mobile pull module

Fetches from the two endpoints and applies the reconcile plan to WatermelonDB in a single atomic batch.

**Files:**
- Create: `apps/mobile/src/sync/pull.ts`
- Modify: `apps/mobile/src/sync/index.ts`

**Interfaces:**
- Consumes: `reconcile` (Task 4); `apiFetch` from `@/api/client`; `database` from `@/storage`; the endpoint contracts from Tasks 2–3
- Produces: `pullTasks(): Promise<void>`, `pullPayslips(): Promise<void>`, `pullAll(): Promise<void>`

- [ ] **Step 1: Write the implementation**

Create `apps/mobile/src/sync/pull.ts`:

```ts
import { database } from "@/storage";
import type { Task, Payslip } from "@/storage/models";
import { apiFetch } from "@/api/client";
import { reconcile, assertRecords, type PullResponse } from "./reconcile";

/**
 * Down-sync (server → phone). Full-replace semantics: each pull fetches the
 * caller's complete current set and makes the local table match it.
 *
 * SAFETY: a failed or malformed response must NEVER be treated as "the server
 * returned an empty set" — under full-replace that would wipe the local table.
 * Every pull therefore only mutates the DB after a successful, shape-checked
 * response (assertRecords); any error leaves local data completely untouched and
 * retries on the next tick.
 *
 * NOTE: the row types below intentionally mirror the server's PulledTask /
 * PulledPayslip (apps/web/src/server/sync/serializers/pull.ts). They are
 * duplicated rather than imported because mobile and web are separate packages
 * with no shared type boundary (the same reason the mobile tRPC client is still
 * untyped). The endpoint route tests are what keep the two in lockstep.
 */

interface PulledTask {
  server_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string;
  due_date: number | null;
  project_id: string | null;
  created_at: number;
  updated_at: number;
  synced: true;
}

interface PulledPayslip {
  server_id: string;
  tenant_id: string;
  user_id: string;
  period_start: number;
  period_end: number;
  gross_pay: number;
  net_pay: number;
  deductions: string;
  created_at: number;
  updated_at: number;
}

export async function pullTasks(): Promise<void> {
  const body = await apiFetch<PullResponse<PulledTask>>("/api/sync/tasks");
  const records = assertRecords(body);

  const collection = database.get<Task>("tasks");
  const local = await collection.query().fetch();

  const plan = reconcile<PulledTask, Task>(records, local, {
    serverKey: (row) => row.server_id,
    localKey: (row) => row.serverId,
    hasPendingWrites: (row) => row.synced === false,
  });

  if (
    plan.toCreate.length === 0 &&
    plan.toUpdate.length === 0 &&
    plan.toDestroy.length === 0
  ) {
    return;
  }

  await database.write(async () => {
    await database.batch(
      ...plan.toCreate.map((row) =>
        collection.prepareCreate((task) => {
          task.tenantId = row.tenant_id;
          task.serverId = row.server_id;
          task.title = row.title;
          task.description = row.description;
          task.status = row.status;
          task.priority = row.priority;
          task.assignedTo = row.assigned_to;
          task.dueDate = row.due_date === null ? null : new Date(row.due_date);
          task.projectId = row.project_id;
          task.synced = true;
        }),
      ),
      ...plan.toUpdate.map(({ local: task, server: row }) =>
        task.prepareUpdate((draft) => {
          draft.title = row.title;
          draft.description = row.description;
          draft.status = row.status;
          draft.priority = row.priority;
          draft.assignedTo = row.assigned_to;
          draft.dueDate = row.due_date === null ? null : new Date(row.due_date);
          draft.projectId = row.project_id;
          draft.synced = true;
        }),
      ),
      ...plan.toDestroy.map((task) => task.prepareDestroyPermanently()),
    );
  });
}

export async function pullPayslips(): Promise<void> {
  const body = await apiFetch<PullResponse<PulledPayslip>>("/api/sync/payslips");
  const records = assertRecords(body);

  const collection = database.get<Payslip>("payslips");
  const local = await collection.query().fetch();

  // Payslips have no `synced` column — the phone never writes them, so this is
  // unconditionally server-wins.
  const plan = reconcile<PulledPayslip, Payslip>(records, local, {
    serverKey: (row) => row.server_id,
    localKey: (row) => row.serverId,
    hasPendingWrites: () => false,
  });

  if (
    plan.toCreate.length === 0 &&
    plan.toUpdate.length === 0 &&
    plan.toDestroy.length === 0
  ) {
    return;
  }

  await database.write(async () => {
    await database.batch(
      ...plan.toCreate.map((row) =>
        collection.prepareCreate((slip) => {
          slip.tenantId = row.tenant_id;
          slip.userId = row.user_id;
          slip.serverId = row.server_id;
          slip.periodStart = new Date(row.period_start);
          slip.periodEnd = new Date(row.period_end);
          slip.grossPay = row.gross_pay;
          slip.netPay = row.net_pay;
          slip.deductions = row.deductions;
        }),
      ),
      ...plan.toUpdate.map(({ local: slip, server: row }) =>
        slip.prepareUpdate((draft) => {
          draft.periodStart = new Date(row.period_start);
          draft.periodEnd = new Date(row.period_end);
          draft.grossPay = row.gross_pay;
          draft.netPay = row.net_pay;
          draft.deductions = row.deductions;
        }),
      ),
      ...plan.toDestroy.map((slip) => slip.prepareDestroyPermanently()),
    );
  });
}

let pullInFlight = false;

/**
 * Pull every down-synced entity. Concurrent invocations (interval tick landing
 * on top of a pull-to-refresh) are a no-op rather than a double fetch.
 * Individual entity failures are isolated so one bad endpoint cannot block the
 * other.
 */
export async function pullAll(): Promise<void> {
  if (pullInFlight) return;
  pullInFlight = true;
  try {
    const results = await Promise.allSettled([pullTasks(), pullPayslips()]);
    for (const result of results) {
      if (result.status === "rejected") {
        // Non-fatal: keep local data, retry next tick.
        console.warn("down-sync pull failed", result.reason);
      }
    }
  } finally {
    pullInFlight = false;
  }
}
```

- [ ] **Step 2: Export the pull surface**

In `apps/mobile/src/sync/index.ts`, add alongside the existing exports:

```ts
export { pullTasks, pullPayslips, pullAll } from "./pull";
export { reconcile } from "./reconcile";
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter @orqafy/mobile typecheck && pnpm --filter @orqafy/mobile lint`
Expected: PASS — 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/sync/pull.ts apps/mobile/src/sync/index.ts
git commit -m "feat(mobile): down-sync pull module for tasks + payslips (atomic batch, fail-safe)"
```

---

### Task 6: Pull triggers — auto-sync, foreground, pull-to-refresh

**Files:**
- Modify: `apps/mobile/src/sync/auto-sync.ts`
- Modify: `apps/mobile/src/app/(app)/tasks/index.tsx`
- Modify: `apps/mobile/src/app/(app)/payslips/index.tsx`

**Interfaces:**
- Consumes: `pullAll` (Task 5), existing `processQueue`

- [ ] **Step 1: Push-then-pull in the auto-sync tick**

Replace the body of `apps/mobile/src/sync/auto-sync.ts` with:

```ts
import NetInfo from "@react-native-community/netinfo";
import { AppState, type AppStateStatus } from "react-native";
import { processQueue } from "./queue";
import { pullAll } from "./pull";
import { SYNC_INTERVAL_MS } from "@/constants";

let syncTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;

/**
 * One sync cycle: push pending local edits FIRST, then adopt server truth.
 * Ordering matters — pushing first means fewer rows are skipped by the pull's
 * pending-writes guard, so the phone converges in one cycle instead of two.
 */
async function runSyncCycle(): Promise<void> {
  const netState = await NetInfo.fetch();
  if (netState.isConnected !== true) return;

  try {
    await processQueue();
  } catch {
    // Silent fail — will retry on next interval
  }

  try {
    await pullAll();
  } catch {
    // Non-fatal: local data is left untouched, retry next interval
  }
}

export function startAutoSync(): void {
  if (syncTimer !== null) return;

  syncTimer = setInterval(() => {
    void runSyncCycle();
  }, SYNC_INTERVAL_MS);

  // Returning to the app should show current data without waiting for a tick.
  appStateSub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") {
      void runSyncCycle();
    }
  });
}

export function stopAutoSync(): void {
  if (syncTimer !== null) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  if (appStateSub !== null) {
    appStateSub.remove();
    appStateSub = null;
  }
}
```

- [ ] **Step 2: Add pull-to-refresh to the Tasks screen**

In `apps/mobile/src/app/(app)/tasks/index.tsx`:

Add `RefreshControl` to the `react-native` import:

```ts
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
```

Add the pull import:

```ts
import { pullAll } from "@/sync";
```

Add refresh state and handler inside the component, after the existing `loadTasks` definition:

```ts
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await pullAll();
      await loadTasks();
    } finally {
      setRefreshing(false);
    }
  }, [loadTasks]);
```

Attach it to the `ScrollView` (the one in the non-empty branch):

```tsx
      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
```

Also wrap the empty-state branch so a worker with zero tasks can still pull to fetch them. Replace the empty-state `return` block with:

```tsx
  if (tasks.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
        >
          <EmptyState
            title="No tasks yet"
            description="Tasks assigned to you will appear here."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }
```

- [ ] **Step 3: Add pull-to-refresh to the Payslips screen**

Apply the identical pattern in `apps/mobile/src/app/(app)/payslips/index.tsx`:

```ts
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { pullAll } from "@/sync";
```

```ts
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await pullAll();
      await loadPayslips();
    } finally {
      setRefreshing(false);
    }
  }, [loadPayslips]);
```

Attach `refreshControl` to the main `ScrollView`, and wrap the empty state in a `ScrollView` with the same `refreshControl` and `contentContainerStyle={{ flexGrow: 1 }}`, exactly as in Step 2.

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm --filter @orqafy/mobile typecheck && pnpm --filter @orqafy/mobile lint`
Expected: PASS — 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/sync/auto-sync.ts "apps/mobile/src/app/(app)/tasks/index.tsx" "apps/mobile/src/app/(app)/payslips/index.tsx"
git commit -m "feat(mobile): pull triggers — push-then-pull tick, app-foreground, pull-to-refresh"
```

---

### Task 7: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the web suite**

Run: `pnpm --filter @orqafy/web test`
Expected: PASS — all pre-existing tests plus the 16 added in Tasks 1–3. No regressions.

- [ ] **Step 2: Run the mobile suite**

Run: `pnpm --filter @orqafy/mobile test`
Expected: PASS — 7 reconcile tests

- [ ] **Step 3: Typecheck both packages**

Run: `pnpm --filter @orqafy/web typecheck && pnpm --filter @orqafy/mobile typecheck`
Expected: 0 errors in both

- [ ] **Step 4: Lint**

Run: `pnpm --filter @orqafy/web lint && pnpm --filter @orqafy/mobile lint`
Expected: 0 errors

- [ ] **Step 5: Confirm no schema drift**

```bash
git diff --stat main -- packages/db/prisma/schema.prisma apps/mobile/src/storage/schema.ts
```

Expected: **empty output.** This plan adds no migration and no WatermelonDB version bump. Any diff here is a bug — stop and investigate.

- [ ] **Step 6: Commit any remaining governance updates**

```bash
git add -A
git commit -m "chore(sync): down-sync verification gate green (web + mobile tests, typecheck, lint)"
```

---

## Out of scope (do not build)

- Down-sync for `dtr_entries` / `expenses` (phone-origin; needs status-backfill merge semantics)
- Incremental cursor sync or server-side tombstones
- Conflict-resolution UI
- Typing the mobile tRPC client (`AnyRouter` → real `AppRouter`)
- Any push, deploy, or promotion — **HARD HOLD**
