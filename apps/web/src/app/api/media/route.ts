// Non-tRPC: manual auth required (security.md L11).
//
// Streams a MediaObject's bytes (Telegram-first, MinIO-fallback — see
// resolveMediaBytes / ~/.claude/rules/media-storage-default.md) so the app UI
// can render tenant-scoped media (attachments, signatures, photos) without
// exposing the underlying storage backend or credentials.
//
// Security posture:
//   - Manual auth via NextAuth `auth()` (tRPC bypassed — no middleware chain).
//   - Tenant scope enforced server-side via the session tenantId. The URL
//     carries only the storage key; the lookup is `tenantId + storageKey`, so
//     cross-tenant access is impossible at the data layer. Returns 404 (not
//     403) on miss — never leaks tenant/key occupancy.
//   - MEDIA_DOWNLOAD AuditLog written BEFORE the byte resolution (egress audit)
//     — an interrupted fetch still leaves a record of the attempt.
//   - Rate-limited via the `mediaDownload` tier.
//   - telegramFileId is never returned to the client; bytes are proxied
//     server-side via the bot token only.

import { type NextRequest, NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";

import { prisma } from "@orqafy/db";
import { auth } from "@/server/auth";
import { rateLimiters } from "@/server/lib/rate-limit";
import { resolveMediaBytes } from "@/server/lib/media-bytes";

// Node runtime required: Telegram fetch + Buffer handling are not supported on
// the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse | Response> {
  const key = req.nextUrl.searchParams.get("key");
  if (key === null || key === "") {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  const tenantId = session?.user?.tenantId;
  const tenantSlug = session?.user?.tenantSlug;
  if (
    userId === undefined ||
    userId === "" ||
    tenantId === undefined ||
    tenantId === null ||
    tenantId === "" ||
    tenantSlug === undefined ||
    tenantSlug === ""
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    rateLimiters.mediaDownload.check(userId);
  } catch (e) {
    if (e instanceof TRPCError && e.code === "TOO_MANY_REQUESTS") {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    throw e;
  }

  // Tenant-scoped lookup — cross-tenant / non-existent keys both fall through
  // to the same 404 below (never 403; that would leak key occupancy).
  const mediaObject = await prisma.mediaObject.findUnique({
    where: {
      tenantId_storageKey: {
        tenantId,
        storageKey: key,
      },
    },
    select: {
      entityType: true,
      mimeType: true,
      telegramFileId: true,
      backend: true,
    },
  });

  if (!mediaObject) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Audit the egress BEFORE the byte resolution so an interrupted fetch still
  // leaves a record of who attempted the download. AuditLog.action is a free
  // String in Orqafy — no enum migration needed.
  await prisma.auditLog.create({
    data: {
      action: "MEDIA_DOWNLOAD",
      userId,
      entity: mediaObject.entityType,
      entityId: key,
    },
  });

  let bytes: Buffer;
  try {
    const resolved = await resolveMediaBytes({
      tenantSlug,
      storageKey: key,
      telegramFileId: mediaObject.telegramFileId,
      mimeType: mediaObject.mimeType,
    });
    bytes = resolved.bytes;
  } catch {
    return NextResponse.json(
      { error: "Media temporarily unavailable" },
      { status: 502 },
    );
  }

  const headers = new Headers({
    "Content-Type": mediaObject.mimeType ?? "application/octet-stream",
    "Content-Length": String(bytes.byteLength),
    // MediaObject bytes are immutable, so allow each authenticated browser to
    // reuse them for repeat views for up to a day. KEEP `private`: these are
    // auth/tenant-scoped media that must NEVER land in a shared CDN/edge cache.
    "Cache-Control": "private, max-age=86400, immutable",
    "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  });

  // Wrap in a fresh Uint8Array so the body is a concrete ArrayBuffer-backed
  // view (BodyInit) regardless of the Buffer's pooled backing store.
  return new Response(new Uint8Array(bytes), { status: 200, headers });
}
