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

const t = () => adminToken ?? undefined;

export const adminApi = {
  login: (password: string) => api<{ token: string }>('/api/admin/login', { method: 'POST', body: { password } }),
  users: () => api<{ users: AdminUser[] }>('/api/admin/users', { token: t() }),
  create: (username: string) => api<CodeResult>('/api/admin/users', { method: 'POST', body: { username }, token: t() }),
  reset: (id: string) => api<CodeResult>(`/api/admin/users/${encodeURIComponent(id)}/reset`, { method: 'POST', token: t() }),
  remove: (id: string) => api<{ ok: true }>(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', token: t() }),
  keys: () => api<{ providers: ProviderView[]; order: string[] }>('/api/admin/keys', { token: t() }),
  saveKey: (id: string, body: { key?: string; model?: string }) =>
    api<{ providers: ProviderView[]; order: string[] }>(`/api/admin/keys/${id}`, { method: 'PUT', body, token: t() }),
  testKey: (id: string, body: { key?: string; model?: string }) =>
    api<{ ok: boolean; message: string }>(`/api/admin/keys/${id}/test`, { method: 'POST', body, token: t() }),
};
