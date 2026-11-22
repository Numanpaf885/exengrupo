/**
 * Answering with the space's reference files. When the space has ready files:
 *   1. one AI call transcribes only the questions in the photo;
 *   2. MiniSearch finds the best chunks (≤ 6,000 characters);
 *   3. both answer calls get them as "Referencia del espacio", with the rule
 *      that the reference wins when it answers the question.
 * The chunks used are logged in posts.models (never shown in the app).
 */
import { analyzePhoto, type AiOutcome } from '../ai/analyze';
import { PROMPT } from '../ai/answers';
import { answerProvider, type VisionClient } from '../ai/providers';
import { FILE_READY, type FileRecord } from '../schema';
import type { ObjectStorage } from '../storage';
import { isTrue, type Table } from '../table';
import type { TextFile } from './handlers';
import { referenceBlock, referenceLog, type RefChunk, searchChunks } from './search';

export const TRANSCRIBE_PROMPT = [
  'Transcribe SOLO las preguntas que se ven en la foto, con su número y sus opciones, en texto plano.',
  'No las respondas y no añadas nada más. Si no se lee ninguna pregunta, responde con una línea vacía.',
].join('\n');

export const REFERENCE_RULE = [
  'Regla: si la "Referencia del espacio" responde a una pregunta, sigue la referencia aunque tu conocimiento general diga otra cosa.',
  'Si la referencia no responde a esa pregunta, respóndela normalmente.',
  'Reply with JSON only, exactly in the format above.',
].join('\n');

/** The answer prompt, with the reference block and its rule when there is one. */
export function promptWithReference(chunks: RefChunk[]): string {
  const block = referenceBlock(chunks);
  return block ? `${PROMPT}${block}\n\n${REFERENCE_RULE}` : PROMPT;
}

/** All chunks of the space's ready files, read from R2. Missing pieces are skipped. */
export async function loadSpaceChunks(files: Table<FileRecord>, storage: ObjectStorage, spaceId: string): Promise<RefChunk[]> {
  const rows = await files.list();
  const ready = rows.map((r) => r.value).filter((f) => f.space_id === spaceId && f.status === FILE_READY && !isTrue(f.deleted));
  const parts = await Promise.all(
    ready.map(async (f) => {
      try {
        const bytes = await storage.get(f.text_key);
        if (!bytes) return [];
        const parsed = JSON.parse(new TextDecoder().decode(bytes)) as TextFile;
        return 'chunks' in parsed ? parsed.chunks.map((c) => ({ ...c, file: f.name })) : [];
      } catch {
        return [];
      }
    }),
  );
  return parts.flat();
}

async function transcribe(clients: VisionClient[], jpegBase64: string, timeoutMs: number): Promise<string> {
  for (const client of clients) {
    const r = await client.call({ prompt: TRANSCRIBE_PROMPT, mime: 'image/jpeg', data: jpegBase64, timeoutMs });
    if (r.ok && r.text.trim()) return r.text;
  }
  return '';
}

export interface RefAnalyzeOptions {
  clients: VisionClient[];
  /** The space's chunks; failures mean "no references". */
  chunks: () => Promise<RefChunk[]>;
  /** No new fallback answer call starts after this moment (ms epoch). */
  fallbackDeadline?: number;
  transcribeTimeoutMs?: number;
  log?: (message: string) => void;
}

export async function analyzeWithReferences(jpegBase64: string, opts: RefAnalyzeOptions): Promise<AiOutcome> {
  let picked: RefChunk[] = [];
  const all = await opts.chunks().catch((e) => {
    opts.log?.(`references: ${e instanceof Error ? e.message : 'error'}`);
    return [] as RefChunk[];
  });
  if (all.length > 0) {
    const questions = await transcribe(opts.clients, jpegBase64, opts.transcribeTimeoutMs ?? 15_000).catch(() => '');
    picked = searchChunks(all, questions);
  }
  const prompt = promptWithReference(picked);
  const outcome = await analyzePhoto(
    opts.clients.map((c) => answerProvider(c, prompt)),
    jpegBase64,
    { fallbackDeadline: opts.fallbackDeadline },
  );
  const log = referenceLog(picked);
  return log ? { ...outcome, models: [outcome.models, log].filter(Boolean).join(' | ') } : outcome;
}
