/**
 * Splits extracted text into ~1,000-character chunks that keep their page
 * number. Chunks never cross a page, break at paragraph or sentence ends when
 * they can, and never cut a word. Pure and unit-tested.
 */
export interface PageText {
  /** 1-based page number; null for formats without pages (.txt, .md, .docx). */
  page: number | null;
  text: string;
}

export interface Chunk {
  page: number | null;
  text: string;
}

export const CHUNK_TARGET = 1000;

const clean = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Pieces no longer than `max`: paragraphs, then sentences, then words. */
function pieces(text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n{2,}/)) {
    if (para.length <= max) {
      out.push(para);
      continue;
    }
    for (const sentence of para.split(/(?<=[.!?…;:])\s+/)) {
      if (sentence.length <= max) {
        out.push(sentence);
        continue;
      }
      let line = '';
      for (const word of sentence.split(/\s+/)) {
        if (line && line.length + 1 + word.length > max) {
          out.push(line);
          line = '';
        }
        // A single "word" longer than max (e.g. a URL) is cut hard.
        if (word.length > max) {
          for (let i = 0; i < word.length; i += max) out.push(word.slice(i, i + max));
          continue;
        }
        line = line ? `${line} ${word}` : word;
      }
      if (line) out.push(line);
    }
  }
  return out;
}

export function chunkPages(pages: PageText[], target = CHUNK_TARGET): Chunk[] {
  const chunks: Chunk[] = [];
  for (const { page, text } of pages) {
    const body = clean(text);
    if (!body) continue;
    let current = '';
    for (const piece of pieces(body, target)) {
      if (current && current.length + 1 + piece.length > target) {
        chunks.push({ page, text: current });
        current = '';
      }
      current = current ? `${current}\n${piece}` : piece;
    }
    if (current) chunks.push({ page, text: current });
  }
  return chunks;
}
