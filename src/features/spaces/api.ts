/** Typed calls to /api/spaces. All return ApiResult (never throw). */
import { api } from '@/lib/api';
import type { PostView } from '@/lib/photo/upload';

export interface SpaceSummary {
  space_id: string;
  name: string;
  join_code: string;
  is_creator: boolean;
  member_count: number;
}

export interface SpaceDetail extends SpaceSummary {
  channel_id: string;
  members: Array<{ user_id: string; username: string; is_creator: boolean }>;
}

const base = (id: string) => `/api/spaces/${encodeURIComponent(id)}`;

export const spacesApi = {
  list: (token: string) => api<{ spaces: SpaceSummary[] }>('/api/spaces', { token }),
  create: (token: string, name: string) =>
    api<{ space: SpaceSummary }>('/api/spaces', { method: 'POST', body: { name }, token }),
  join: (token: string, code: string) =>
    api<{ space: { space_id: string; name: string } }>('/api/spaces/join', { method: 'POST', body: { code }, token }),
  get: (token: string, id: string) => api<{ space: SpaceDetail }>(base(id), { token }),
  rename: (token: string, id: string, name: string) =>
    api<{ space: { space_id: string; name: string } }>(base(id), { method: 'PATCH', body: { name }, token }),
  remove: (token: string, id: string) => api<{ ok: true }>(base(id), { method: 'DELETE', token }),
  removeMember: (token: string, id: string, userId: string) =>
    api<{ ok: true }>(`${base(id)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE', token }),
  posts: (token: string, id: string) => api<{ posts: PostView[] }>(`${base(id)}/posts`, { token }),
  post: (token: string, id: string, postId: string) =>
    api<{ post: PostView }>(`${base(id)}/posts/${encodeURIComponent(postId)}`, { token }),
};
