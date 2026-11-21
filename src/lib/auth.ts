import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { limiterIp } from '@/lib/ratelimit';

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

// ── Token lifetimes (PRD AUTH-3) ──
// A short access token (the incubator_token cookie) plus a refresh token that is traded for
// a new pair and works once. See startSession / rotateRefresh below.
export const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 7 * 24 * 3600_000;
/** A sign-in ends this long after it started, however active the user is. */
const FAMILY_MAX_MS = 30 * 24 * 3600_000;
/** Two tabs refreshing with the same token at once is a race, not theft. */
const REUSE_GRACE_MS = 30_000;
export const REFRESH_COOKIE = 'incubator_refresh';
/** Readable by scripts, holds no secret: tells the browser a refresh is worth trying. */
export const SIGNED_IN_HINT = 'incubator_signed_in';

export function signToken(payload: JWTPayload): string {
  const { userId, email, name, role, image, sv } = payload;
  return jwt.sign({ userId, email, name, role, sv, ...(image ? { image } : {}) }, JWT_SECRET, { expiresIn: ACCESS_TTL_S });
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
  await prisma.refreshToken.deleteMany({ where: { userId } });
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
  maxAge: ACCESS_TTL_S,
  path: '/',
};

export const COOKIE_NAME_EXPORT = COOKIE_NAME;

// ── Sessions: access + refresh tokens ──
const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');

export type SessionSubject = { id: string; email: string; name: string; role: string; image?: string | null; sessionVersion: number };

/** Set a fresh access token only (after a rename); the refresh token stays as it is. */
export function setAccessCookie(res: NextResponse, u: SessionSubject) {
  res.cookies.set(COOKIE_NAME, signToken({ userId: u.id, email: u.email, name: u.name, role: u.role as Role, sv: u.sessionVersion, ...(u.image ? { image: u.image } : {}) }), SESSION_COOKIE);
}

/**
 * Sign a user in on this response: a 15-minute access token and a single-use refresh token.
 * Pass the family of the token being rotated to continue that sign-in; omit it to start one.
 */
export async function startSession(res: NextResponse, req: NextRequest, u: SessionSubject, family?: { id: string; from: Date }) {
  const now = Date.now();
  const fam = family ?? { id: randomBytes(16).toString('hex'), from: new Date(now) };
  const expiresAt = new Date(Math.min(now + REFRESH_TTL_MS, fam.from.getTime() + FAMILY_MAX_MS));
  const raw = randomBytes(32).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId: u.id, tokenHash: sha256(raw), familyId: fam.id, familyFrom: fam.from, sv: u.sessionVersion, expiresAt,
      ip: limiterIp(req), userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    },
  });
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - now) / 1000));
  setAccessCookie(res, u);
  res.cookies.set(REFRESH_COOKIE, raw, { ...SESSION_COOKIE, maxAge });
  res.cookies.set(SIGNED_IN_HINT, '1', { ...SESSION_COOKIE, httpOnly: false, maxAge });
}

export function clearSessionCookies(res: NextResponse) {
  for (const name of [COOKIE_NAME, REFRESH_COOKIE, SIGNED_IN_HINT]) res.cookies.set(name, '', { ...SESSION_COOKIE, httpOnly: name !== SIGNED_IN_HINT, maxAge: 0 });
}

export type RotateResult =
  | { ok: true; user: SessionSubject; family: { id: string; from: Date } }
  | { ok: false; reason: 'missing' | 'invalid' | 'raced' }
  | { ok: false; reason: 'reused'; user: { userId: string; name: string; role: string } };

/**
 * Trade the refresh cookie for the right to a new pair. The token is used up whatever happens.
 * 'raced': another tab just refreshed with the same token; its new cookies already apply.
 * 'reused': a token used earlier came back, so it was copied; every session of the account is signed out.
 */
export async function rotateRefresh(req: NextRequest): Promise<RotateResult> {
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!raw || raw.length < 20 || raw.length > 100) return { ok: false, reason: 'missing' };
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: { select: { id: true, email: true, name: true, role: true, image: true, sessionVersion: true } } },
  });
  if (!row) return { ok: false, reason: 'invalid' };
  if (row.usedAt) {
    if (Date.now() - row.usedAt.getTime() < REUSE_GRACE_MS) return { ok: false, reason: 'raced' };
    await revokeSessions(row.userId);
    return { ok: false, reason: 'reused', user: { userId: row.user.id, name: row.user.name, role: row.user.role } };
  }
  if (row.expiresAt <= new Date() || row.sv !== row.user.sessionVersion) return { ok: false, reason: 'invalid' };
  const claimed = await prisma.refreshToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return { ok: false, reason: 'raced' };
  return { ok: true, user: row.user, family: { id: row.familyId, from: row.familyFrom } };
}

/** Sign out of this browser: ends the sign-in the refresh cookie belongs to. */
export async function endSession(req: NextRequest, res: NextResponse) {
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  if (raw) {
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) }, select: { familyId: true } });
    if (row) await prisma.refreshToken.deleteMany({ where: { familyId: row.familyId } });
  }
  clearSessionCookies(res);
}
