import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./constants";

const SECRET =
  process.env.SESSION_SECRET ?? "dev-only-secret-change-me";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function issueToken(sessionId: string, expiresAt: Date): string {
  const payload = `${sessionId}.${expiresAt.getTime()}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

function readToken(token: string): { sessionId: string; expiresAt: Date } | null {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  if (sign(payload) !== sig) return null;
  const [sessionId, exp] = payload.split(".");
  const expiresAt = new Date(Number(exp));
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return null;
  }
  return { sessionId, expiresAt };
}

export type RequestMeta = {
  ip?: string | null;
  userAgent?: string | null;
};

type HeaderAccessor = { get(name: string): string | null | undefined };

export function metaFromHeaders(headers: HeaderAccessor): RequestMeta {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return { ip, userAgent: headers.get("user-agent") };
}

export async function createSession(
  userId: string,
  meta: RequestMeta,
  isMfaVerified: boolean,
) {
  const token = randomBytes(32).toString("hex");
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: token,
      ip: meta.ip,
      userAgent: meta.userAgent,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      mfaVerifiedAt: isMfaVerified ? new Date() : null,
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, issueToken(session.id, session.expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  return session;
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return getSessionFromToken(token);
}

export async function getSessionFromToken(
  token: string | undefined | null,
) {
  if (!token) return null;
  const parsed = readToken(token);
  if (!parsed) return null;
  const session = await prisma.session.findUnique({
    where: { id: parsed.sessionId },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return session;
}

export function cookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requireRole(role: string) {
  const session = await requireSession();
  if (session.user.role !== role) throw new Error("FORBIDDEN");
  return session;
}

export async function touchSession(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { lastActiveAt: new Date() },
  });
}

export async function revokeSession(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function revokeAllSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function metaFromRequest(req: Request): Promise<RequestMeta> {
  return metaFromHeaders(req.headers);
}