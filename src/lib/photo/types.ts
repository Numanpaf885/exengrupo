/** A compressed JPEG ready to upload. On web it carries the Blob; on Android a file URI. */
export interface ReadyPhoto {
  uri: string;
  width: number;
  height: number;
  blob?: Blob;
}
