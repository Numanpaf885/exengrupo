/** Accepted reference-file types and limits. */
export const FILE_LIMITS = {
  maxBytes: 50 * 1024 * 1024,
  maxPages: 500,
  maxFilesPerSpace: 20,
  /** Scanned PDFs (no text layer) are OCR'd by the vision AI, up to this many pages. */
  maxScannedPages: 30,
  /** Pages per OCR request (one request per processing step). */
  ocrPagesPerStep: 3,
  /** A "procesando" file older than this is shown as failed (the phone stopped driving it). */
  staleMs: 15 * 60 * 1000,
  uploadUrlSeconds: 15 * 60,
} as const;

export type FileKind = 'pdf' | 'image' | 'text' | 'docx';

const TYPES: Record<string, { kind: FileKind; mime: string }> = {
  pdf: { kind: 'pdf', mime: 'application/pdf' },
  jpg: { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  png: { kind: 'image', mime: 'image/png' },
  txt: { kind: 'text', mime: 'text/plain' },
  md: { kind: 'text', mime: 'text/markdown' },
  docx: { kind: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
};

/** The file's extension when it's an accepted type ("jpeg" is stored as "jpg"), else null. */
export function fileType(name: string): { ext: string; kind: FileKind; mime: string } | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase();
  if (!ext || !TYPES[ext]) return null;
  return { ext: ext === 'jpeg' ? 'jpg' : ext, ...TYPES[ext] };
}

export const FILE_MSG = {
  badType: 'Tipo de archivo no admitido. Usa PDF, JPG, PNG, TXT, MD o DOCX.',
  tooBig: 'El archivo pesa demasiado (máximo 50 MB).',
  empty: 'El archivo está vacío.',
  tooMany: 'Este espacio ya tiene 20 archivos. Borra alguno para añadir otro.',
  badName: 'El archivo necesita un nombre.',
  notFound: 'Ese archivo no existe.',
  notAllowed: 'Solo quien subió el archivo o quien creó el espacio puede borrarlo.',
  notUploaded: 'No llegó el archivo. Súbelo de nuevo.',
  tooManyPages: 'El PDF tiene más de 500 páginas: súbelo en partes.',
  scannedTooLong: 'PDF escaneado demasiado largo: súbelo en partes',
  noPdfAi: 'Para leer PDF escaneados hace falta una clave de Claude o Gemini.',
  noAi: 'No hay ninguna clave de IA configurada para leer el archivo.',
  noText: 'No se encontró texto en el archivo.',
  unreadable: 'No se pudo leer el archivo. Comprueba que no esté dañado o protegido.',
  ocrFailed: 'No se pudo leer el archivo con la IA. Prueba de nuevo.',
  stale: 'El procesado no terminó. Borra el archivo y súbelo de nuevo.',
  failed: 'No se pudo procesar el archivo. Prueba de nuevo.',
  noTab: 'Falta la pestaña «files» en la hoja de datos.',
} as const;
