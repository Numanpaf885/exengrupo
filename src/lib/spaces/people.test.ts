import { describe, expect, it } from 'vitest';
import { filterPeople, pickedSummary, toggleId } from './people';

const list = [
  { user_id: '1', username: 'ana' },
  { user_id: '2', username: 'josé.m' },
  { user_id: '3', username: 'luis' },
];

describe('filterPeople', () => {
  it('matches ignoring case and accents, and skips excluded people', () => {
    expect(filterPeople(list, '').map((p) => p.user_id)).toEqual(['1', '2', '3']);
    expect(filterPeople(list, ' JOSE ').map((p) => p.user_id)).toEqual(['2']);
    expect(filterPeople(list, 'a', new Set(['1'])).map((p) => p.user_id)).toEqual([]);
    expect(filterPeople(list, 's', new Set(['3'])).map((p) => p.user_id)).toEqual(['2']);
  });
});

describe('toggleId', () => {
  it('adds and removes without changing the original', () => {
    const a = new Set(['1']);
    expect([...toggleId(a, '2')]).toEqual(['1', '2']);
    expect([...toggleId(a, '1')]).toEqual([]);
    expect([...a]).toEqual(['1']);
  });
});

describe('pickedSummary', () => {
  it('says who will be added', () => {
    expect(pickedSummary(0, [])).toBe('');
    expect(pickedSummary(1, ['ana'])).toBe('Se añadirá a ana.');
    expect(pickedSummary(3, ['a', 'b', 'c'])).toBe('Se añadirán 3 personas.');
  });
});
