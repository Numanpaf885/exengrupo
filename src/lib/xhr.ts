/**
 * React Native's own XMLHttpRequest. On Android, Expo replaces the global
 * fetch with expo/fetch, which cannot send a FormData file given by `uri`
 * and cannot read local file:// URIs — both failed silently as "Sin conexión".
 * XHR still does both, so local files go through here.
 */
import { type ApiResult, apiUrl, OFFLINE_MESSAGE } from './api';
import { setOffline } from './connectivity';

const SERVER_MESSAGE = 'Error del servidor. Prueba de nuevo.';

/** POST a multipart FormData (with `{ uri, name, type }` file parts) to /api. */
export function xhrPostForm<T>(path: string, form: FormData, token?: string): Promise<ApiResult<T>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl(path));
    if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.onload = () => {
      setOffline(false);
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON response (e.g. a proxy error page)
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ ok: true, data: data as T });
      const error =
        data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : SERVER_MESSAGE;
      resolve({ ok: false, status: xhr.status, error });
    };
    xhr.onerror = () => {
      setOffline(true);
      resolve({ ok: false, status: 0, error: OFFLINE_MESSAGE });
    };
    xhr.send(form);
  });
}

/** Reads a local file (file:// or content://) into a Blob. */
export function readLocalBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', uri);
    xhr.responseType = 'blob';
    xhr.onload = () => (xhr.response ? resolve(xhr.response as Blob) : reject(new Error('empty file')));
    xhr.onerror = () => reject(new Error('could not read the file'));
    xhr.send();
  });
}
