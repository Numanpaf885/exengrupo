import { api, type ApiResult } from '../api';
import { xhrPostForm } from '../xhr';
import type { ReadyPhoto } from './types';

export interface PostView {
  post_id: string;
  user_id: string;
  username: string;
  status: 'processing' | 'done' | 'error' | string;
  answer: string;
  /** Which AI gave each answer, by question number (missing on old servers). */
  labels?: Record<string, string>;
  created_at: string;
}

/** POST /api/spaces/:id/posts as multipart "photo". The reply includes the answer. */
export function uploadPhoto(spaceId: string, photo: ReadyPhoto, token: string): Promise<ApiResult<{ post: PostView }>> {
  const path = `/api/spaces/${encodeURIComponent(spaceId)}/posts`;
  const form = new FormData();
  if (photo.blob) {
    // Web: a real Blob, sent with fetch.
    form.append('photo', photo.blob, 'foto.jpg');
    return api<{ post: PostView }>(path, { method: 'POST', form, token });
  }
  // Android: a file on the phone. Only React Native's XHR can send a `{ uri }` part
  // (Expo's fetch cannot and failed as "Sin conexión").
  form.append('photo', { uri: photo.uri, name: 'foto.jpg', type: 'image/jpeg' } as unknown as Blob);
  return xhrPostForm<{ post: PostView }>(path, form, token);
}
