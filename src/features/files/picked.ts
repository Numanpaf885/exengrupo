/** A file chosen on the phone, ready to upload. */
export interface PickedFile {
  name: string;
  size: number;
  mime: string;
  blob: Blob;
}

export const ACCEPTED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/html',
  // Many phones don't know .md and report it as a generic file; the type is checked by extension.
  'text/*',
  'application/octet-stream',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ACCEPT_ATTR =
  '.pdf,.jpg,.jpeg,.png,.txt,.md,.markdown,.html,.htm,.docx,' +
  ACCEPTED_MIME.filter((m) => m !== 'application/octet-stream').join(',');

/** Same extensions the server accepts (server/files/types.ts). */
export const ACCEPTED_EXT = /\.(pdf|jpe?g|png|txt|md|markdown|html?|docx)$/i;
export const BAD_TYPE = 'Tipo de archivo no admitido. Usa PDF, JPG, PNG, TXT, MD, HTML o DOCX.';

/** "PDF", "DOCX", ... for the list. */
export const typeLabel = (type: string) => (type === 'jpg' || type === 'png' ? 'Imagen' : type.toUpperCase());
