import { describe, expect, it } from 'vitest';
import { chunkPages } from './chunk';
import { normalizeTerm, referenceBlock, referenceLog, searchChunks } from './search';

describe('chunkPages', () => {
  it('keeps page numbers and never crosses a page', () => {
    const chunks = chunkPages([
      { page: 1, text: 'Primera página.' },
      { page: 2, text: 'Segunda página.' },
    ]);
    expect(chunks).toEqual([
      { page: 1, text: 'Primera página.' },
      { page: 2, text: 'Segunda página.' },
    ]);
  });

  it('splits long text into ~1,000-character chunks at sentence ends', () => {
    const sentence = 'La presión es la fuerza por unidad de superficie y se mide en pascales. ';
    const chunks = chunkPages([{ page: 7, text: sentence.repeat(60) }]);
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) {
      expect(c.page).toBe(7);
      expect(c.text.length).toBeLessThanOrEqual(1000);
      expect(c.text.endsWith('pascales.')).toBe(true);
    }
    expect(chunks.map((c) => c.text).join(' ').replace(/\s+/g, ' ')).toBe(sentence.repeat(60).trim());
  });

  it('never cuts a word, even without punctuation', () => {
    const words = Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(' ');
    const chunks = chunkPages([{ page: null, text: words }]);
    expect(chunks.flatMap((c) => c.text.split(' '))).toEqual(words.split(' '));
    expect(chunks.every((c) => c.page === null && c.text.length <= 1000)).toBe(true);
  });

  it('skips empty pages and normalises whitespace', () => {
    expect(chunkPages([{ page: 1, text: '  \n\n ' }, { page: 2, text: 'a\t\tb\r\n\r\n\r\n\r\nc' }])).toEqual([
      { page: 2, text: 'a b\nc' },
    ]);
  });
});

describe('search', () => {
  const chunks = [
    { file: 'fisica.pdf', page: 12, text: 'La presión atmosférica a nivel del mar es de 101.325 pascales.' },
    { file: 'fisica.pdf', page: 30, text: 'La fotosíntesis ocurre en los cloroplastos de las células vegetales.' },
    { file: 'notas.docx', page: null, text: 'El agua hierve a 100 °C cuando la presion es de una atmósfera.' },
  ];

  it('normalises accents and case and drops stop words', () => {
    expect(normalizeTerm('Presión')).toBe('presion');
    expect(normalizeTerm('ATMOSFÉRICA,')).toBe('atmosferica');
    expect(normalizeTerm('de')).toBeNull();
    expect(normalizeTerm('x')).toBeNull();
  });

  it('"presión" matches "presion" and the other way round', () => {
    const a = searchChunks(chunks, '¿Cuál es la presión a nivel del mar?');
    expect(a.map((c) => c.file + c.page)).toContain('notas.docxnull');
    expect(a[0].page).toBe(12);
    const b = searchChunks(chunks, 'presion atmosferica');
    expect(b[0].page).toBe(12);
  });

  it('returns nothing for an unrelated question and respects the character limit', () => {
    expect(searchChunks(chunks, 'Revolución francesa')).toEqual([]);
    expect(searchChunks(chunks, 'presión agua fotosíntesis', 80)).toHaveLength(1);
  });

  it('formats the prompt block and the log with file names and pages', () => {
    const picked = searchChunks(chunks, 'presión');
    expect(referenceBlock(picked)).toContain('Referencia del espacio');
    expect(referenceBlock(picked)).toContain('[fisica.pdf, p. 12]');
    expect(referenceLog(picked)).toBe('ref: fisica.pdf p12; notas.docx');
    expect(referenceBlock([])).toBe('');
  });
});
