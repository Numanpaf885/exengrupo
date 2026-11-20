/**
 * Stateless session tokens: `v1.<base64url payload>.<base64url HMAC-SHA256>`.
 * Valid for 30 days. Signed with SESSION_SECRET. Server-only (node:crypto).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export interface SessionPayload {
  /** user_id */
  sub: string;
  /** username at sign-in time */
  usr: string;
  /** expiry, ms since epoch */
  exp: number;
}

const b64url = (buf: Buffer): string => buf.toString('base64url');

function sign(data: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(data).digest());
}

export function signSession(
  user: { userId: string; username: string },
  secret: string,
  now: number = Date.now(),
): string {
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const payload: SessionPayload = { sub: user.userId, usr: user.username, exp: now + SESSION_MS };
  const body = `v1.${b64url(Buffer.from(JSON.stringify(payload)))}`;
  return `${body}.${sign(body, secret)}`;
}

/** Returns the payload, or null if the token is malformed, tampered with or expired. */
export function verifySession(token: string, secret: string, now: number = Date.now()): SessionPayload | null {
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.sub !== 'string' || typeof payload.usr !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }
    return payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}
