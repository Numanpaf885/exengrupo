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

/** Permission to send the file through /api in pieces of `chunk_bytes`. */
export interface UploadTarget {
  token: string;
  chunk_bytes: number;
  chunks: number;
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
  process: (token: string, spaceId: string, fileId: string, step: number, chunks?: number) =>
    api<ProcessReply>(`${base(spaceId)}/${encodeURIComponent(fileId)}/process`, {
      method: 'POST',
      body: { step, chunks },
      token,
    }),
  chunkPath: (spaceId: string, fileId: string, index: number) =>
    `${base(spaceId)}/${encodeURIComponent(fileId)}/chunks/${index}`,
  remove: (token: string, spaceId: string, fileId: string) =>
    api<{ ok: true }>(`${base(spaceId)}/${encodeURIComponent(fileId)}`, { method: 'DELETE', token }),
};
