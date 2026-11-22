/** Web: the browser never closes the page while the camera app is open; nothing to recover. */
export interface RecoveredPhoto {
  spaceId: string;
  uri: string;
  width: number;
  height: number;
}

export async function rememberCameraSpace(_spaceId: string): Promise<void> {}
export async function forgetCameraSpace(): Promise<void> {}
export async function recoverCameraPhoto(): Promise<RecoveredPhoto | null> {
  return null;
}
