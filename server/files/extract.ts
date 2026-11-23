/**
 * Turns an uploaded reference file into page texts, one processing step at a
 * time (every step fits in one Vercel call):
 *  - .txt / .md: read as is; .html: tags stripped (html.ts); .docx: mammoth.
 *  - PDF with a text layer: unpdf, page by page.
 *  - Scanned PDF (≤ 30 pages) or image: OCR with the vision AI, 3 pages per step.
 */
import type { PageText } from './chunk';
import { decodeHtml, htmlToText } from './html';
import { type FileKind, FILE_LIMITS, FILE_MSG } from './types';
import type { ProviderResult, VisionClient, VisionInput } from '../ai/providers';
import { quotaMessage } from '../ai/answers';
import { retryMinutes } from '../ai/retry';

export class FileError extends Error {}

export type StepOutcome =
  | { done: true; pages: number; texts: PageText[] }
  | { done: false; pages: number; texts: PageText[]; nextStep: number };

export const OCR_PROMPT = [
  'Transcribe TODO el texto de este documento, tal cual y en su idioma original.',
  'Empieza cada página con una línea "=== Página N ===" (N = número de página dentro de este documento, empezando en 1).',
  'Incluye títulos, fórmulas, tablas (como texto) y pies de imagen. No resumas, no traduzcas y no añadas comentarios.',
].join('\n');

/** Splits OCR output on "=== Página N ===" markers into absolute page numbers. */
export function splitOcrPages(text: string, firstPage: number, count: number): PageText[] {
  const marker = /^\s*=+\s*p[aá]gina\s+(\d+)\s*=+\s*$/gim;
  const hits = [...text.matchAll(marker)];
  if (hits.length === 0) return [{ page: firstPage, text: text.trim() }];
  return hits.map((m, i) => {
    const n = Math.min(Math.max(Number(m[1]), 1), count);
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length;
    return { page: firstPage + n - 1, text: text.slice((m.index ?? 0) + m[0].length, end).trim() };
  });
}

/** Runs the OCR prompt on the first provider that can read it, in preference order. */
export async function ocr(clients: VisionClient[], input: Omit<VisionInput, 'prompt'>): Promise<string> {
  const usable = input.mime === 'application/pdf' ? clients.filter((c) => c.pdf) : clients;
  if (usable.length === 0) throw new FileError(input.mime === 'application/pdf' ? FILE_MSG.noPdfAi : FILE_MSG.noAi);
  const failures: Array<ProviderResult & { ok: false }> = [];
  for (const client of usable) {
    const r = await client.call({ ...input, prompt: OCR_PROMPT, timeoutMs: input.timeoutMs ?? 45_000 });
    if (r.ok && r.text.trim()) return r.text;
    if (!r.ok) failures.push(r);
  }
  if (failures.length === usable.length && failures.every((f) => f.rateLimited)) {
    throw new FileError(quotaMessage(retryMinutes(failures.map((f) => f.retryAfterSec))));
  }
  throw new FileError(FILE_MSG.ocrFailed);
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

/** True when most pages have (almost) no text layer. */
export function looksScanned(pageTexts: string[]): boolean {
  if (pageTexts.length === 0) return true;
  const empty = pageTexts.filter((t) => t.replace(/\s+/g, '').length < 20).length;
  return empty / pageTexts.length > 0.5;
}

async function pdfPart(bytes: Uint8Array, from: number, to: number): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, Array.from({ length: to - from }, (_, i) => from + i));
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

async function pdfPageCount(bytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  return (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount();
}

async function scannedStep(bytes: Uint8Array, total: number, step: number, clients: VisionClient[]): Promise<StepOutcome> {
  const per = FILE_LIMITS.ocrPagesPerStep;
  const from = step * per;
  const to = Math.min(from + per, total);
  const part = await pdfPart(bytes, from, to);
  const text = await ocr(clients, { mime: 'application/pdf', data: b64(part) });
  const texts = splitOcrPages(text, from + 1, to - from);
  return to >= total ? { done: true, pages: total, texts } : { done: false, pages: total, texts, nextStep: step + 1 };
}

/** One processing step. `step` 0 is the first; scanned PDFs need more steps. */
export async function extractStep(
  kind: FileKind,
  mime: string,
  bytes: Uint8Array,
  step: number,
  clients: () => Promise<VisionClient[]>,
): Promise<StepOutcome> {
  if (kind === 'text') {
    return { done: true, pages: 1, texts: [{ page: null, text: new TextDecoder('utf-8').decode(bytes) }] };
  }
  if (kind === 'html') {
    return { done: true, pages: 1, texts: [{ page: null, text: htmlToText(decodeHtml(bytes)) }] };
  }
  if (kind === 'docx') {
    const mammoth = await import('mammoth');
    let value: string;
    try {
      ({ value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) }));
    } catch {
      throw new FileError(FILE_MSG.unreadable);
    }
    return { done: true, pages: 1, texts: [{ page: null, text: value }] };
  }
  if (kind === 'image') {
    const text = await ocr(await clients(), { mime: mime as 'image/jpeg' | 'image/png', data: b64(bytes) });
    return { done: true, pages: 1, texts: [{ page: 1, text: text.replace(/^\s*=+\s*p[aá]gina\s+\d+\s*=+\s*$/gim, '').trim() }] };
  }

  // PDF
  if (step > 0) return scannedStep(bytes, await pdfPageCount(bytes), step, await clients());
  let pageTexts: string[];
  try {
    const { getDocumentProxy, extractText } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    if (pdf.numPages > FILE_LIMITS.maxPages) throw new FileError(FILE_MSG.tooManyPages);
    pageTexts = (await extractText(pdf, { mergePages: false })).text;
  } catch (e) {
    if (e instanceof FileError) throw e;
    throw new FileError(FILE_MSG.unreadable);
  }
  const total = pageTexts.length;
  if (!looksScanned(pageTexts)) {
    return { done: true, pages: total, texts: pageTexts.map((text, i) => ({ page: i + 1, text })) };
  }
  if (total > FILE_LIMITS.maxScannedPages) throw new FileError(FILE_MSG.scannedTooLong);
  return scannedStep(bytes, total, 0, await clients());
}
