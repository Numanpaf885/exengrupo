/**
 * Spanish keyword search over a space's chunks with MiniSearch: accent- and
 * case-insensitive, prefix + light fuzzy matching, common Spanish words ignored.
 * No external service and no embeddings. Pure and unit-tested.
 */
import MiniSearch from 'minisearch';
import type { Chunk } from './chunk';

export interface RefChunk extends Chunk {
  file: string;
}

/** Most frequent Spanish words that carry no meaning for search. */
const STOP = new Set(
  (
    'a al algo algun alguna algunas alguno algunos ante antes aqui asi aun cada como con contra cual cuales cuando de del desde donde dos el ella ellas ellos en entre era eran es esa esas ese eso esos esta estan estas este esto estos fue fueron ha han hay la las le les lo los mas me mi mis mucho muy nada ni no nos o otra otras otro otros para pero poco por porque que quien se sea segun ser si sin sobre son su sus tambien tan te tiene tienen todo todos tu un una unas uno unos y ya yo ' +
    'cual cuanto indica marca senala responde completa explica calcula verdadero falso pregunta respuesta opcion correcta siguiente siguientes'
  ).split(/\s+/),
);

/** Lower-case, strip accents ("presión" → "presion"), drop stop words and 1-letter tokens. */
export function normalizeTerm(term: string): string | null {
  const t = term
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]/g, '');
  if (t.length < 2 || STOP.has(t)) return null;
  return t;
}

export const REFERENCE_LIMIT = 6000;

/** The best chunks for `query`, in score order, until `limit` characters. */
export function searchChunks(chunks: RefChunk[], query: string, limit = REFERENCE_LIMIT): RefChunk[] {
  if (!query.trim() || chunks.length === 0) return [];
  const index = new MiniSearch<{ id: number; text: string }>({
    fields: ['text'],
    processTerm: (term) => normalizeTerm(term) ?? false,
  });
  index.addAll(chunks.map((c, id) => ({ id, text: c.text })));
  const hits = index.search(query, { prefix: (t) => t.length >= 4, fuzzy: (t) => (t.length >= 6 ? 0.2 : false), combineWith: 'OR' });
  const picked: RefChunk[] = [];
  let used = 0;
  for (const hit of hits) {
    const chunk = chunks[hit.id as number];
    if (used + chunk.text.length > limit) continue;
    picked.push(chunk);
    used += chunk.text.length;
    if (used >= limit - 200) break;
  }
  return picked;
}

/** "Referencia del espacio" block added to the answer prompt. */
export function referenceBlock(chunks: RefChunk[]): string {
  if (chunks.length === 0) return '';
  const parts = chunks.map((c) => `[${c.file}${c.page ? `, p. ${c.page}` : ''}]\n${c.text}`);
  return `\n\nReferencia del espacio (fragmentos de los archivos del grupo):\n${parts.join('\n\n')}`;
}

/** Short log of the chunks used, for the posts.models column. Never shown in the app. */
export function referenceLog(chunks: RefChunk[]): string {
  const seen = [...new Set(chunks.map((c) => `${c.file}${c.page ? ` p${c.page}` : ''}`))];
  return seen.length ? `ref: ${seen.join('; ')}` : '';
}
