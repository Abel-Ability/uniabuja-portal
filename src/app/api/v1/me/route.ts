import { NextResponse } from "next/server";
import { getSessionFromToken, cookieValue } from "@/lib/session";
import { SESSION_COOKIE, ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Session-protected endpoint. Uses the same HMAC session cookie as the web
// app; demonstrates cookie-based auth for API consumers.
export async function GET(request: Request) {
  const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE);
  const session = await getSessionFromToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const u = session.user;
  return NextResponse.json({
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role] ?? u.role,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  });
}
