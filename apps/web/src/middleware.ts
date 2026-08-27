import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { isPublic } from "@/lib/public-paths";
import { resolvePrincipalIsolationRedirect } from "@/lib/portal-routing";

export { isPublic } from "@/lib/public-paths";

export default auth(function middleware(req) {
  const { pathname } = req.nextUrl;

  // Always allow public paths
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // API routes (tRPC, Auth.js) enforce their own auth + tenant scoping inside their
  // handlers/procedures. The tenant-slug guard below is for PAGE routes ONLY — if it
  // runs on /api/* it misreads the first segment ("api") as a tenant slug and
  // 307-redirects every client-side tRPC request to /<slug>/dashboard, breaking all
  // mutations + the notifications poll. (Matcher also excludes /api; this is belt-and-suspenders.)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const session = req.auth;

  // Unauthenticated — redirect to login
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session was invalidated (role/tenant change, suspension, password change)
  if ((session as { error?: string }).error === "SESSION_INVALIDATED") {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(loginUrl);
  }

  // Extract tenant slug from URL: /[slug]/...
  const slugMatch = /^\/([^/]+)(\/.*)?$/.exec(pathname);
  const urlSlug = slugMatch?.[1];

  // Skip slug validation for non-tenant paths (root, /login, etc.)
  if (urlSlug === undefined || urlSlug === "") {
    return NextResponse.next();
  }

  // Principal isolation (W1-T1.4) — staff never sees the customer portal
  // surface, customers never see the staff (app) surface. MUST run BEFORE the
  // demo fast-path below: that fast-path waves any authed user onto any /demo/*
  // route, so leaving isolation after it let a demo-tenant CUSTOMER load the
  // staff app shell (caught in the W2 E2E browser walk). Isolation depends only
  // on principalType + whether the path is a /portal/* path, not on tenant match.
  const principalType = (session as { principalType?: "staff" | "customer" }).principalType;
  const isolationRedirect = resolvePrincipalIsolationRedirect(pathname, urlSlug, principalType);
  if (isolationRedirect !== null) {
    return NextResponse.redirect(new URL(isolationRedirect, req.url));
  }

  const sessionSlug = (session.user as { tenantSlug?: string })?.tenantSlug;

  // Demo tenant fast-path — any authenticated user may visit /demo
  if (urlSlug === "demo") {
    return NextResponse.next();
  }

  // Cross-tenant access attempt — redirect to own tenant
  if (sessionSlug !== undefined && urlSlug !== sessionSlug) {
    return NextResponse.redirect(new URL(`/${sessionSlug}/dashboard`, req.url));
  }

  // Suspended tenant — redirect to login with error
  const isSuspended = (session.user as { tenantIsActive?: boolean })?.tenantIsActive === false;
  if (isSuspended) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", "tenant_suspended");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  runtime: "nodejs",
  matcher: [
    /*
     * Match all paths except API routes, static files, and Next.js internals.
     * /api/* (tRPC + Auth.js) is excluded — those handlers enforce their own auth;
     * running the tenant-slug guard on them misreads "api" as a tenant slug.
     */
    "/((?!api|_next/static|_next/image|images|fonts|icons).*)",
  ],
};
