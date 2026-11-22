/** Web / iPhone: the site always serves the newest version; nothing to check. */
import type { AvailableUpdate } from '@/lib/update/version';

export function useAppUpdate(): AvailableUpdate | null {
  return null;
}

export function dismissUpdate(_build: number): void {}
