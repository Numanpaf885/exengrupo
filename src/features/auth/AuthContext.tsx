import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { parseStoredSession, serializeSession, type SessionUser, type StoredSession } from '@/lib/session/session';
import { clearSession, loadSession, saveSession } from '@/lib/session/tokenStore';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: SessionUser | null;
  token: string | null;
  /** Returns a Spanish error message, or null on success. */
  login(username: string, password: string): Promise<string | null>;
  register(username: string, password: string): Promise<string | null>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const signOut = useCallback(async () => {
    await clearSession();
    setSession(null);
    setStatus('signedOut');
  }, []);

  // On start: use the stored session at once (works offline), then check it with /api/auth/me.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = parseStoredSession(await loadSession());
      if (cancelled) return;
      if (!stored) {
        setStatus('signedOut');
        return;
      }
      setSession(stored);
      setStatus('signedIn');
      const res = await api<{ user: SessionUser }>('/api/auth/me', { token: stored.token });
      if (cancelled) return;
      if (res.ok) {
        const next = { token: stored.token, user: res.data.user };
        setSession(next);
        await saveSession(serializeSession(next));
      } else if (res.status === 401) {
        await signOut();
      }
      // Offline or server error: keep the stored session.
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  const authenticate = useCallback(async (path: string, username: string, password: string) => {
    const res = await api<StoredSession>(path, { method: 'POST', body: { username, password } });
    if (!res.ok) return res.error;
    await saveSession(serializeSession(res.data));
    setSession(res.data);
    setStatus('signedIn');
    return null;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user: session?.user ?? null,
      token: session?.token ?? null,
      login: (u, p) => authenticate('/api/auth/login', u, p),
      register: (u, p) => authenticate('/api/auth/register', u, p),
      logout: signOut,
    }),
    [status, session, authenticate, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
