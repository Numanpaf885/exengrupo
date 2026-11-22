/** Typed calls to /api/spaces/:id/files. All return ApiResult (never throw). */
import { api } from '@/lib/api';

export interface FileView {
  file_id: string;
  name: string;
  type: string;
  pages: number | null;
  size_bytes: number;
  status: 'procesando' | 'listo' | 'error' | string;
  error: string;
  created_at: string;
  uploader: string;
  can_delete: boolean;
}

export interface UploadTarget {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export interface ProcessReply {
  file: FileView;
  done: boolean;
  next_step?: number;
  progress?: { done_pages: number; total_pages: number };
}

const base = (id: string) => `/api/spaces/${encodeURIComponent(id)}/files`;

export const filesApi = {
  list: (token: string, spaceId: string) => api<{ files: FileView[] }>(base(spaceId), { token }),
  create: (token: string, spaceId: string, name: string, size: number) =>
    api<{ file: FileView; upload: UploadTarget }>(base(spaceId), { method: 'POST', body: { name, size }, token }),
  process: (token: string, spaceId: string, fileId: string, step: number) =>
    api<ProcessReply>(`${base(spaceId)}/${encodeURIComponent(fileId)}/process`, { method: 'POST', body: { step }, token }),
  remove: (token: string, spaceId: string, fileId: string) =>
    api<{ ok: true }>(`${base(spaceId)}/${encodeURIComponent(fileId)}`, { method: 'DELETE', token }),
};
