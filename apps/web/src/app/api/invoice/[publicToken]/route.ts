// Non-tRPC: public invoice view — no auth, no session, no tenant middleware.
// publicToken is a signed opaque token generated server-side on invoice creation.
// Phase 8 will validate the token and return invoice JSON for the public view page.
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  const { publicToken } = await params;

  if (!publicToken || publicToken.length < 8) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  // TODO(Phase 8): validate publicToken → fetch invoice → return sanitised payload
  return NextResponse.json(
    { message: "Invoice view not yet implemented", publicToken },
    { status: 501 },
  );
}
