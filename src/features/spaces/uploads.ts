/**
 * Photos being sent. The camera screen starts an upload and goes straight back
 * to the feed (compression runs in the background too); the feed shows
 * "Preparando…" / "Enviando y analizando…" rows and refreshes when one finishes.
 */
import { useSyncExternalStore } from 'react';
import type { ReadyPhoto } from '@/lib/photo/types';
import { uploadPhoto } from '@/lib/photo/upload';

export interface Upload {
  id: string;
  spaceId: string;
  state: 'preparing' | 'sending' | 'error';
  error?: string;
}

let uploads: Upload[] = [];
let finished = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let nextId = 0;

const update = (id: string, patch: Partial<Upload>) => {
  uploads = uploads.map((u) => (u.id === id ? { ...u, ...patch } : u));
  emit();
};

/** `prepare` compresses the photo; it runs after the camera screen has already closed. */
export function startUpload(spaceId: string, prepare: () => Promise<ReadyPhoto>, token: string): void {
  const id = `u${++nextId}`;
  uploads = [{ id, spaceId, state: 'preparing' }, ...uploads];
  emit();
  void (async () => {
    let photo: ReadyPhoto;
    try {
      photo = await prepare();
    } catch {
      return update(id, { state: 'error', error: 'No se pudo preparar la foto. Prueba de nuevo.' });
    }
    update(id, { state: 'sending' });
    const res = await uploadPhoto(spaceId, photo, token);
    if (photo.blob) URL.revokeObjectURL(photo.uri);
    if (res.ok) {
      uploads = uploads.filter((u) => u.id !== id);
      finished++;
      emit();
    } else {
      update(id, { state: 'error', error: res.error });
    }
  })();
}

export function dismissUpload(id: string): void {
  uploads = uploads.filter((u) => u.id !== id);
  emit();
}

/** Uploads for one space, plus a counter that grows each time one finishes. */
export function useUploads(spaceId: string): { list: Upload[]; finished: number } {
  const list = useSyncExternalStore(subscribe, () => uploads);
  const count = useSyncExternalStore(subscribe, () => finished);
  return { list: list.filter((u) => u.spaceId === spaceId), finished: count };
}
