/** Admin panel calls. The admin token lives only in memory (closing the app signs the admin out). */
import { api } from '@/lib/api';

let adminToken: string | null = null;
export const getAdminToken = () => adminToken;
export const setAdminToken = (t: string | null) => {
  adminToken = t;
};

export interface AdminUser {
  user_id: string;
  username: string;
  status: 'active' | 'pending' | 'expired';
  code_expires_at: string;
  created_at: string;
  last_login: string;
  spaces: number;
  /** May create spaces from the app. */
  can_create: boolean;
}

export interface AdminSpace {
  space_id: string;
  name: string;
  join_code: string;
  creator_id: string;
  created_at: string;
  /** Hidden from its members (its creator still sees it). */
  archived: boolean;
  members: Array<{ user_id: string; username: string; is_creator: boolean }>;
}

export interface ProviderView {
  id: 'claude' | 'gemini' | 'groq' | 'openrouter';
  label: string;
  key_set: boolean;
  key_hint: string;
  key_source: 'admin' | 'vercel' | 'none';
  model: string;
  model_source: 'admin' | 'vercel' | 'default';
  model_default: string;
}

export interface CodeResult {
  user: { user_id: string; username: string };
  code: string;
  expires_at: string;
}

export interface UsageWindow {
  day: number;
  week: number;
  total: number;
}

export interface UsageView {
  photos: UsageWindow;
  errors: UsageWindow;
  quota: UsageWindow;
  unreadable: UsageWindow;
  with_references: UsageWindow;
  providers: Array<
    UsageWindow & {
      id: ProviderView['id'];
      model: string;
      last_at: string;
      failed?: UsageWindow;
      last_error?: string;
      last_error_at?: string;
    }
  >;
  daily: Array<{ date: string; photos: number }>;
  configured: Record<string, boolean>;
  openrouter_credits: { usage: number; limit: number | null; free_tier: boolean } | null;
}

const t = () => adminToken ?? undefined;

export const adminApi = {
  login: (password: string) => api<{ token: string }>('/api/admin/login', { method: 'POST', body: { password } }),
  users: () => api<{ users: AdminUser[] }>('/api/admin/users', { token: t() }),
  create: (username: string) => api<CodeResult>('/api/admin/users', { method: 'POST', body: { username }, token: t() }),
  reset: (id: string) => api<CodeResult>(`/api/admin/users/${encodeURIComponent(id)}/reset`, { method: 'POST', token: t() }),
  remove: (id: string) => api<{ ok: true }>(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', token: t() }),
  setCreator: (id: string, canCreate: boolean) =>
    api<{ user_id: string; can_create: boolean }>(`/api/admin/users/${encodeURIComponent(id)}/creator`, {
      method: 'PUT',
      body: { can_create: canCreate },
      token: t(),
    }),
  spaces: () => api<{ spaces: AdminSpace[] }>('/api/admin/spaces', { token: t() }),
  createSpace: (body: { name: string; creator_id: string; member_ids: string[] }) =>
    api<{ space: { space_id: string } }>('/api/admin/spaces', { method: 'POST', body, token: t() }),
  archiveSpace: (id: string, archived: boolean) =>
    api<{ space_id: string; archived: boolean }>(`/api/admin/spaces/${encodeURIComponent(id)}/archive`, {
      method: 'PUT',
      body: { archived },
      token: t(),
    }),
  deleteSpace: (id: string) => api<{ ok: true }>(`/api/admin/spaces/${encodeURIComponent(id)}`, { method: 'DELETE', token: t() }),
  addMembers: (id: string, userIds: string[]) =>
    api<{ ok: true }>(`/api/admin/spaces/${encodeURIComponent(id)}/members`, {
      method: 'POST',
      body: { user_ids: userIds },
      token: t(),
    }),
  removeMember: (id: string, userId: string) =>
    api<{ ok: true }>(`/api/admin/spaces/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      token: t(),
    }),
  keys: () => api<{ providers: ProviderView[]; order: string[] }>('/api/admin/keys', { token: t() }),
  saveKey: (id: string, body: { key?: string; model?: string }) =>
    api<{ providers: ProviderView[]; order: string[] }>(`/api/admin/keys/${id}`, { method: 'PUT', body, token: t() }),
  usage: () => api<UsageView>('/api/admin/usage', { token: t() }),
  testKey: (id: string, body: { key?: string; model?: string }) =>
    api<{ ok: boolean; message: string }>(`/api/admin/keys/${id}/test`, { method: 'POST', body, token: t() }),
};
