/**
 * Stateless session tokens: `v1.<base64url payload>.<base64url HMAC-SHA256>`.
 * Valid for 30 days. Signed with SESSION_SECRET. Server-only (node:crypto).
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export interface SessionPayload {
  /** user_id */
  sub: string;
  /** username at sign-in time */
  usr: string;
  /** expiry, ms since epoch */
  exp: number;
  /** password version: changes when the password is reset, which signs out every device */
  pv?: string;
}

/** Short fingerprint of a password_hash cell, stored in the token as `pv`. */
export const passwordVersion = (passwordHash: string): string =>
  createHash('sha256').update(passwordHash).digest('base64url').slice(0, 12);

const b64url = (buf: Buffer): string => buf.toString('base64url');

function sign(data: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(data).digest());
}

export function signSession(
  user: { userId: string; username: string; passwordHash?: string },
  secret: string,
  now: number = Date.now(),
): string {
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const payload: SessionPayload = { sub: user.userId, usr: user.username, exp: now + SESSION_MS };
  if (user.passwordHash) payload.pv = passwordVersion(user.passwordHash);
  return signToken('v1', payload, secret);
}

/** `<prefix>.<base64url JSON>.<HMAC>`; the prefix keeps user and admin tokens apart. */
export function signToken(prefix: string, payload: object, secret: string): string {
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const body = `${prefix}.${b64url(Buffer.from(JSON.stringify(payload)))}`;
  return `${body}.${sign(body, secret)}`;
}

/** Verifies signature and prefix; returns the parsed payload (expiry is checked by callers). */
export function verifyToken(token: string, prefix: string, secret: string): Record<string, unknown> | null {
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== prefix) return null;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Returns the payload, or null if the token is malformed, tampered with or expired. */
export function verifySession(token: string, secret: string, now: number = Date.now()): SessionPayload | null {
  const payload = verifyToken(token, 'v1', secret) as Partial<SessionPayload> | null;
  if (!payload) return null;
  if (typeof payload.sub !== 'string' || typeof payload.usr !== 'string' || typeof payload.exp !== 'number') {
    return null;
  }
  if (payload.pv !== undefined && typeof payload.pv !== 'string') return null;
  return payload.exp > now ? (payload as SessionPayload) : null;
}
