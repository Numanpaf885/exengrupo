/**
 * Username / password rules, shared by the screens and the /api server.
 * Error messages are Spanish and shown to the user as-is.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
/** bcrypt only uses the first 72 bytes of a password. */
export const PASSWORD_MAX_BYTES = 72;

/** Usernames are case-insensitive: stored and compared in lowercase. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function usernameError(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) {
    return `El usuario debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres.`;
  }
  if (!/^[a-z0-9._-]+$/.test(u)) {
    return 'El usuario solo puede tener letras sin acento, números, punto, guion y guion bajo.';
  }
  return null;
}

function utf8Length(s: string): number {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  }
  if (utf8Length(password) > PASSWORD_MAX_BYTES) {
    return 'La contraseña es demasiado larga.';
  }
  return null;
}
