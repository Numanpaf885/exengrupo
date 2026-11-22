/**
 * Reference files being added: create the row → PUT the bytes straight to R2
 * (presigned URL, with progress) → run the processing steps until "listo" or
 * "error". Runs in the background, so leaving the screen doesn't stop it.
 */
import { useSyncExternalStore } from 'react';
import { OFFLINE_MESSAGE } from '@/lib/api';
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

function put(target: UploadTarget, blob: Blob, onProgress: (pct: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', target.url);
    Object.entries(target.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(blob);
  });
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
    const sent = await put(created.data.upload, file.blob, (pct) => patch(id, { progress: `${pct} %` }));
    if (!sent) {
      // Tell the server to close the row ("No llegó el archivo") so it doesn't stay "procesando".
      await filesApi.process(token, spaceId, created.data.file.file_id, 0);
      return failWith(OFFLINE_MESSAGE);
    }
    patch(id, { state: 'procesando', progress: '' });
    let step = 0;
    for (let guard = 0; guard < 40; guard++) {
      const res = await filesApi.process(token, spaceId, created.data.file.file_id, step);
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
