/**
 * Photos being sent. The camera screen starts an upload and goes straight back
 * to the feed; the feed shows "Enviando…" rows and refreshes when one finishes.
 */
import { useSyncExternalStore } from 'react';
import type { ReadyPhoto } from '@/lib/photo/types';
import { uploadPhoto } from '@/lib/photo/upload';

export interface Upload {
  id: string;
  spaceId: string;
  state: 'sending' | 'error';
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

export function startUpload(spaceId: string, photo: ReadyPhoto, token: string): void {
  const id = `u${++nextId}`;
  uploads = [{ id, spaceId, state: 'sending' }, ...uploads];
  emit();
  void uploadPhoto(spaceId, photo, token).then((res) => {
    if (photo.blob) URL.revokeObjectURL(photo.uri);
    if (res.ok) {
      uploads = uploads.filter((u) => u.id !== id);
      finished++;
    } else {
      uploads = uploads.map((u) => (u.id === id ? { ...u, state: 'error', error: res.error } : u));
    }
    emit();
  });
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
