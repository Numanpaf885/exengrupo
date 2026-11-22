/**
 * Web: keeps track of EVERY camera stream a screen opens (the permission probe,
 * the chosen camera, a second "Abrir cámara" tap…) so all of them can be
 * stopped. A stream that is left running keeps the phone's camera indicator on
 * until the tab is closed. Pure (no DOM types needed), unit-tested.
 */
export interface StoppableStream {
  getTracks(): Array<{ stop(): void }>;
}

export class CameraStreams<S extends StoppableStream = StoppableStream> {
  private readonly open = new Set<S>();
  private closed = false;

  /** Registers a new stream. Returns false (and stops it) if the screen already closed. */
  add(stream: S): boolean {
    if (this.closed) {
      stopStream(stream);
      return false;
    }
    this.open.add(stream);
    return true;
  }

  /** Stops one stream (e.g. the permission probe) and forgets it. */
  stop(stream: S | null | undefined): void {
    if (!stream) return;
    stopStream(stream);
    this.open.delete(stream);
  }

  /** Stops every stream still running (leaving the screen, taking the photo, app hidden). */
  stopAll(): void {
    for (const s of this.open) stopStream(s);
    this.open.clear();
  }

  /** The screen is gone: stop everything, and stop any stream that arrives later. */
  close(): void {
    this.closed = true;
    this.stopAll();
  }

  /** The screen is usable again (e.g. "Abrir cámara" after it was released). */
  reopen(): void {
    this.closed = false;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  get size(): number {
    return this.open.size;
  }
}

export function stopStream(stream: StoppableStream): void {
  for (const t of stream.getTracks()) t.stop();
}
