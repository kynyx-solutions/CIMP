import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = 'incubator_token';

export type Role =
  | 'incubatee'
  | 'mentor'
  | 'admin_it'
  | 'ceo'
  | 'sr_manager'
  | 'manager'
  | 'executive'
  | 'staff'
  | 'accounts'
  | 'social_media';

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
  image?: string;
  /** User.sessionVersion when the token was issued; a higher version in the DB revokes it. */
  sv?: number;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/** Signature and expiry only. Use verifySession for anything that grants access. */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

// ── Session revocation ──
// Every request checks the token against the user's row, so a deleted user, a role change,
// a password change or "sign out everywhere" takes effect within SESSION_CACHE_MS.
// The short in-process cache keeps this to about one query per user per 15 seconds.
const SESSION_CACHE_MS = 15_000;
type Live = { sv: number; role: string; name: string; email: string; at: number } | null;
const live = new Map<string, { v: Live; at: number }>();

async function liveUser(userId: string): Promise<Live> {
  const hit = live.get(userId);
  if (hit && Date.now() - hit.at < SESSION_CACHE_MS) return hit.v;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true, role: true, name: true, email: true } });
  const v: Live = u ? { sv: u.sessionVersion, role: u.role, name: u.name, email: u.email, at: Date.now() } : null;
  live.set(userId, { v, at: Date.now() });
  if (live.size > 5000) live.delete(live.keys().next().value as string);
  return v;
}

/** Verify a session token: signature, expiry, and that the user still exists with the same session version. */
export async function verifySession(token: string): Promise<JWTPayload | null> {
  const p = verifyToken(token);
  if (!p?.userId) return null;
  const u = await liveUser(p.userId);
  if (!u || u.sv !== (p.sv ?? 0)) return null;
  // Role and name come from the database, so a role change applies without signing in again.
  return { ...p, role: u.role as Role, name: u.name, email: u.email };
}

/** Revoke every session of a user (password change, sign out everywhere, role change). Returns the new version. */
export async function revokeSessions(userId: string): Promise<number> {
  const u = await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } }, select: { sessionVersion: true } });
  live.delete(userId);
  return u.sessionVersion;
}

/** Forget the cached row (after deleting a user or changing a role). */
export function forgetSession(userId: string) {
  live.delete(userId);
}

export async function getTokenFromCookies(): Promise<JWTPayload | null> {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySession(token);
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
};

export const COOKIE_NAME_EXPORT = COOKIE_NAME;
