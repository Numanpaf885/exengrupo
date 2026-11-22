/** AES-256-GCM for API keys kept in the Sheet's "ajustes" tab. Key derived from SESSION_SECRET. */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const keyFrom = (secret: string) => createHash('sha256').update(`exengrupo-ajustes:${secret}`).digest();

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ct.toString('base64url')}`;
}

/** Returns null when the value is not ours or the secret changed. */
export function decryptSecret(value: string, secret: string): string | null {
  const [tag0, v, iv, tag, ct] = value.split(':');
  if (tag0 !== 'enc' || v !== 'v1' || !iv || !tag || ct === undefined) return null;
  try {
    const d = createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** "…ab12" — never more than the last 4 characters. */
export const keyHint = (key: string): string => (key.length > 8 ? `…${key.slice(-4)}` : '…');
