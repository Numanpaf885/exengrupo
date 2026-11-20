/** Web / iPhone PWA: the session is kept in localStorage. */
const KEY = 'exengrupo.session';

export async function loadSession(): Promise<string | null> {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function saveSession(value: string): Promise<void> {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // private mode / storage blocked: the user stays signed in for this visit only
  }
}

export async function clearSession(): Promise<void> {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
