/** Typed calls to /api/spaces. All return ApiResult (never throw). */
import { api } from '@/lib/api';
import type { PostView } from '@/lib/photo/upload';
import type { Person } from '@/lib/spaces/people';

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
  /** `can_create`: may this user create spaces (the admin decides). */
  list: (token: string) => api<{ spaces: SpaceSummary[]; can_create?: boolean }>('/api/spaces', { token }),
  create: (token: string, name: string, memberIds: string[] = []) =>
    api<{ space: SpaceSummary }>('/api/spaces', { method: 'POST', body: { name, member_ids: memberIds }, token }),
  /** People who can be added to a space (only for people who may create spaces or created one). */
  people: (token: string) => api<{ people: Person[] }>('/api/spaces/people', { token }),
  addMembers: (token: string, id: string, userIds: string[]) =>
    api<{ space: SpaceDetail }>(`${base(id)}/members`, { method: 'POST', body: { user_ids: userIds }, token }),
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
