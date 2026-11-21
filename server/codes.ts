/** Join codes and channel ids. Pure (randomness is injected) and unit-tested. */

/** 6 capital letters; I, L and O are left out so codes are easy to read aloud. */
export const JOIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const JOIN_CODE_LENGTH = 6;

/** `randomIndex(n)` must return an integer in [0, n). */
export function generateJoinCode(randomIndex: (n: number) => number): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) code += JOIN_ALPHABET[randomIndex(JOIN_ALPHABET.length)];
  return code;
}

/** Normalizes what a user typed ("abc def", "abcdef ") to "ABCDEF"; null if it can't be a code. */
export function normalizeJoinCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== JOIN_CODE_LENGTH) return null;
  for (const ch of code) if (!JOIN_ALPHABET.includes(ch)) return null;
  return code;
}

/** A code that no active space is using. Throws after too many collisions. */
export function uniqueJoinCode(taken: Set<string>, randomIndex: (n: number) => number, tries = 20): string {
  for (let i = 0; i < tries; i++) {
    const code = generateJoinCode(randomIndex);
    if (!taken.has(code)) return code;
  }
  throw new Error('Could not find a free join code');
}

/** Realtime channel id: 32 url-safe characters from 24 random bytes. */
export function channelIdFromBytes(bytes: Uint8Array): string {
  if (bytes.length < 24) throw new Error('Need at least 24 random bytes');
  return Buffer.from(bytes).toString('base64url');
}
