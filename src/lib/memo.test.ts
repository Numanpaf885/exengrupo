import { describe, expect, it } from 'vitest';
import { createMemo } from './memo';

describe('createMemo', () => {
  it('returns what was stored and nothing for unknown keys', () => {
    const m = createMemo();
    m.set('a', { n: 1 });
    expect(m.get('a')).toEqual({ n: 1 });
    expect(m.get('b')).toBeUndefined();
  });

  it('drops the oldest entry beyond the limit, counting a re-set as fresh', () => {
    const m = createMemo(2);
    m.set('a', 1);
    m.set('b', 2);
    m.set('a', 3);
    m.set('c', 4);
    expect(m.get('b')).toBeUndefined();
    expect(m.get('a')).toBe(3);
    expect(m.get('c')).toBe(4);
  });

  it('shares one running load between callers and allows a new one afterwards', async () => {
    const m = createMemo();
    let calls = 0;
    const load = () => new Promise<number>((r) => setTimeout(() => r(++calls), 1));
    const [x, y] = await Promise.all([m.dedupe('k', load), m.dedupe('k', load)]);
    expect([x, y]).toEqual([1, 1]);
    expect(await m.dedupe('k', load)).toBe(2);
  });

  it('clear forgets everything', () => {
    const m = createMemo();
    m.set('a', 1);
    m.clear();
    expect(m.get('a')).toBeUndefined();
  });
});
