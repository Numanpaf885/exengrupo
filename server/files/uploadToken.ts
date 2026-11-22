/**
 * Short-lived permission to upload the pieces of one reference file. Given by
 * POST /files (after the member check), checked on every piece without reading
 * the Sheet: `u1.<base64url JSON {f,s,u,exp}>.<HMAC-SHA256>`.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface UploadGrant {
  fileId: string;
  spaceId: string;
  userId: string;
}

export const UPLOAD_TOKEN_TTL_MS = 60 * 60 * 1000;

const mac = (payload: string, secret: string) => createHmac('sha256', secret).update(`upload:${payload}`).digest('base64url');

export function signUploadToken(grant: UploadGrant, secret: string, now: number, ttlMs = UPLOAD_TOKEN_TTL_MS): string {
  const payload = Buffer.from(
    JSON.stringify({ f: grant.fileId, s: grant.spaceId, u: grant.userId, exp: now + ttlMs }),
  ).toString('base64url');
  return `u1.${payload}.${mac(payload, secret)}`;
}

export function verifyUploadToken(token: string, secret: string, now: number): UploadGrant | null {
  const [v, payload, sig] = token.split('.');
  if (v !== 'u1' || !payload || !sig) return null;
  const expected = Buffer.from(mac(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { f?: string; s?: string; u?: string; exp?: number };
    if (!p.f || !p.s || !p.u || typeof p.exp !== 'number' || p.exp < now) return null;
    return { fileId: p.f, spaceId: p.s, userId: p.u };
  } catch {
    return null;
  }
}
