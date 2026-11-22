import { api, type ApiResult } from '../api';
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
  const form = new FormData();
  if (photo.blob) {
    form.append('photo', photo.blob, 'foto.jpg');
  } else {
    // React Native's FormData accepts a file descriptor object.
    form.append('photo', { uri: photo.uri, name: 'foto.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  return api<{ post: PostView }>(`/api/spaces/${encodeURIComponent(spaceId)}/posts`, { method: 'POST', form, token });
}
