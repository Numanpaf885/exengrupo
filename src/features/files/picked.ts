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
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.txt,.md,.docx,' + ACCEPTED_MIME.join(',');

/** "PDF", "DOCX", ... for the list. */
export const typeLabel = (type: string) => (type === 'jpg' || type === 'png' ? 'Imagen' : type.toUpperCase());
