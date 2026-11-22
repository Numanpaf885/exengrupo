import { Platform } from 'react-native';
import { apiBase } from './apiBase';
import { setOffline } from './connectivity';

const BASE = apiBase(Platform.OS, process.env.EXPO_PUBLIC_API_URL);

/** Full URL of an /api path (for requests that can't use api(), e.g. uploads with progress). */
export const apiUrl = (path: string): string => `${BASE}${path}`;

export const OFFLINE_MESSAGE = 'Sin conexión. Revisa tu internet y prueba de nuevo.';
const SERVER_MESSAGE = 'Error del servidor. Prueba de nuevo.';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** JSON request to /api. Never throws: network failures come back as status 0. */
export async function api<T>(
  path: string,
  {
    method = 'GET',
    body,
    form,
    token,
  }: { method?: string; body?: unknown; form?: FormData; token?: string } = {},
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      // multipart: let fetch set the boundary header itself
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    setOffline(true);
    return { ok: false, status: 0, error: OFFLINE_MESSAGE };
  }
  setOffline(false);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response (e.g. a proxy error page)
  }
  if (res.ok) return { ok: true, data: data as T };
  const error =
    data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
      ? (data as { error: string }).error
      : SERVER_MESSAGE;
  return { ok: false, status: res.status, error };
}
