import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { isPublic } from "@/lib/public-paths";

export { isPublic } from "@/lib/public-paths";

export default auth(function middleware(req) {
  const { pathname } = req.nextUrl;

  // Always allow public paths
  if (isPublic(pathname)) {
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
     * Match all paths except static files and Next.js internals.
     * Auth.js handles its own /api/auth routes — they pass through PUBLIC_PATHS check.
     */
    "/((?!_next/static|_next/image|images|fonts|icons).*)",
  ],
};
