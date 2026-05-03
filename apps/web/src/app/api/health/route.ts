// Non-tRPC: health check endpoint — no auth, no tenant context.
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
