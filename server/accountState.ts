/**
 * Account state lives in the fixed `users.password_hash` cell (the users tab
 * has no other column for it):
 *   "$2…"                                   active (bcrypt hash of the password)
 *   "setup:v1:<hmac>:<expiresMs>:<tries>"   waiting for a one-time code
 *   "deleted:v1:<iso>"                      deleted by the admin
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SETUP_CODE_TTL_MS = 72 * 60 * 60 * 1000;
export const SETUP_MAX_ATTEMPTS = 5;
/** No 0/O/1/I/L/U look-alikes (same alphabet as Libros). */
export const SETUP_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

export type AccountState =
  | { kind: 'active' }
  | { kind: 'pending'; hash: string; expiresAt: number; attempts: number }
  | { kind: 'deleted'; at: string };

export function parseAccountState(passwordHash: string): AccountState {
  if (passwordHash.startsWith('setup:v1:')) {
    const [, , hash, exp, tries] = passwordHash.split(':');
    return { kind: 'pending', hash: hash ?? '', expiresAt: Number(exp) || 0, attempts: Number(tries) || 0 };
  }
  if (passwordHash.startsWith('deleted:')) return { kind: 'deleted', at: passwordHash.split(':').slice(2).join(':') };
  return { kind: 'active' };
}

export const pendingCell = (hash: string, expiresAt: number, attempts: number): string =>
  `setup:v1:${hash}:${expiresAt}:${attempts}`;
export const deletedCell = (iso: string): string => `deleted:v1:${iso}`;

/** 12 characters, shown as XXXX-XXXX-XXXX. `randomIndex(n)` returns an integer in [0, n). */
export function generateSetupCode(randomIndex: (n: number) => number): string {
  let s = '';
  for (let i = 0; i < 12; i++) s += SETUP_ALPHABET[randomIndex(SETUP_ALPHABET.length)];
  return s;
}

export const formatSetupCode = (c: string): string => `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;

/** Whatever was typed (spaces, hyphens, lower case) → the 12 plain characters. */
export const normalizeSetupCode = (c: string): string => c.toUpperCase().replace(/[\s-]+/g, '');

/** Keyed hash; only this is stored, never the code. */
export const hashSetupCode = (code: string, secret: string): string =>
  createHmac('sha256', `setup-code:${secret}`).update(normalizeSetupCode(code)).digest('hex');

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Is the pending code still usable at `now`? */
export const codeUsable = (s: AccountState, now: number): boolean =>
  s.kind === 'pending' && !!s.hash && s.attempts < SETUP_MAX_ATTEMPTS && s.expiresAt > now;
