/**
 * Reference files being added: create the row → send the file through /api in
 * ≤ 4 MB pieces (with progress, each retried) → run the processing steps until
 * "listo" or "error". Runs in the background, so leaving the screen doesn't stop it.
 */
import { useSyncExternalStore } from 'react';
import { apiUrl, OFFLINE_MESSAGE } from '@/lib/api';
import { filesApi, type UploadTarget } from './api';
import type { PickedFile } from './picked';

export interface FileJob {
  id: string;
  spaceId: string;
  name: string;
  state: 'subiendo' | 'procesando' | 'error';
  /** e.g. "45 %" or "6 de 30 páginas". */
  progress: string;
  error?: string;
}

let jobs: FileJob[] = [];
let finished = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const patch = (id: string, p: Partial<FileJob>) => {
  jobs = jobs.map((j) => (j.id === id ? { ...j, ...p } : j));
  emit();
};

type PieceResult = { ok: true } | { ok: false; error: string };

/** PUT one piece with upload progress. */
function putPiece(url: string, token: string, piece: Blob, onProgress: (sent: number) => void): Promise<PieceResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', 'application/octet-stream');
    xhr.setRequestHeader('x-upload-token', token);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ ok: true });
      let error = 'No se pudo subir el archivo. Prueba de nuevo.';
      try {
        const body = JSON.parse(xhr.responseText) as { error?: string };
        if (body.error) error = body.error;
      } catch {
        // keep the generic message
      }
      resolve({ ok: false, error });
    };
    xhr.onerror = () => resolve({ ok: false, error: OFFLINE_MESSAGE });
    xhr.send(piece);
  });
}

/** Sends every piece in order; each piece is retried twice on a network error. */
async function sendPieces(
  spaceId: string,
  fileId: string,
  target: UploadTarget,
  blob: Blob,
  onProgress: (pct: number) => void,
): Promise<PieceResult> {
  const total = blob.size || 1;
  for (let i = 0; i < target.chunks; i++) {
    const start = i * target.chunk_bytes;
    const piece = blob.slice(start, Math.min(start + target.chunk_bytes, blob.size));
    let result: PieceResult = { ok: false, error: OFFLINE_MESSAGE };
    for (let attempt = 0; attempt < 3; attempt++) {
      result = await putPiece(apiUrl(filesApi.chunkPath(spaceId, fileId, i)), target.token, piece, (sent) =>
        onProgress(Math.min(99, Math.round(((start + sent) / total) * 100))),
      );
      if (result.ok || result.error !== OFFLINE_MESSAGE) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    if (!result.ok) return result;
  }
  onProgress(100);
  return { ok: true };
}

let nextId = 0;

export function startFileUpload(spaceId: string, file: PickedFile, token: string): void {
  const id = `f${++nextId}`;
  jobs = [{ id, spaceId, name: file.name, state: 'subiendo', progress: '0 %' }, ...jobs];
  emit();
  const failWith = (error: string) => patch(id, { state: 'error', error });
  void (async () => {
    const created = await filesApi.create(token, spaceId, file.name, file.size);
    if (!created.ok) return failWith(created.error);
    const fileId = created.data.file.file_id;
    const target = created.data.upload;
    const sent = await sendPieces(spaceId, fileId, target, file.blob, (pct) => patch(id, { progress: `${pct} %` }));
    if (!sent.ok) {
      // Tell the server to close the row ("No llegó el archivo") so it doesn't stay "procesando".
      await filesApi.process(token, spaceId, fileId, 0);
      return failWith(sent.error);
    }
    patch(id, { state: 'procesando', progress: '' });
    let step = 0;
    for (let guard = 0; guard < 40; guard++) {
      const res = await filesApi.process(token, spaceId, fileId, step, step === 0 ? target.chunks : undefined);
      if (!res.ok) return failWith(res.error);
      if (res.data.done) {
        if (res.data.file.status === 'error') return failWith(res.data.file.error);
        jobs = jobs.filter((j) => j.id !== id);
        finished++;
        emit();
        return;
      }
      const p = res.data.progress;
      if (p) patch(id, { progress: `${p.done_pages} de ${p.total_pages} páginas` });
      step = res.data.next_step ?? step + 1;
    }
    failWith('No se pudo procesar el archivo. Prueba de nuevo.');
  })();
}

export function dismissFileJob(id: string): void {
  jobs = jobs.filter((j) => j.id !== id);
  emit();
}

export function useFileJobs(spaceId: string): { list: FileJob[]; finished: number } {
  const list = useSyncExternalStore(subscribe, () => jobs);
  const count = useSyncExternalStore(subscribe, () => finished);
  return { list: list.filter((j) => j.spaceId === spaceId), finished: count };
}
