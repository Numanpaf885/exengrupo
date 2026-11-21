import { describe, expect, it } from 'vitest';
import { matchSpacesRoute, spacesPath } from './router';

const seg = (u: string) => spacesPath(new URL(u, 'https://exengrupo.vercel.app'));

describe('spaces router', () => {
  it('reads the path from the rewrite query or the pathname', () => {
    expect(seg('/api/spaces?__path=abc/posts')).toEqual(['abc', 'posts']);
    expect(seg('/api/spaces/abc/members/u1')).toEqual(['abc', 'members', 'u1']);
    expect(seg('/api/spaces')).toEqual([]);
  });

  it('matches every route', () => {
    expect(matchSpacesRoute('GET', [])).toEqual({ name: 'list' });
    expect(matchSpacesRoute('POST', [])).toEqual({ name: 'create' });
    expect(matchSpacesRoute('POST', ['join'])).toEqual({ name: 'join' });
    expect(matchSpacesRoute('GET', ['s1'])).toEqual({ name: 'get', spaceId: 's1' });
    expect(matchSpacesRoute('PATCH', ['s1'])).toEqual({ name: 'rename', spaceId: 's1' });
    expect(matchSpacesRoute('DELETE', ['s1'])).toEqual({ name: 'delete', spaceId: 's1' });
    expect(matchSpacesRoute('DELETE', ['s1', 'members', 'u2'])).toEqual({ name: 'removeMember', spaceId: 's1', userId: 'u2' });
    expect(matchSpacesRoute('GET', ['s1', 'posts'])).toEqual({ name: 'listPosts', spaceId: 's1' });
    expect(matchSpacesRoute('POST', ['s1', 'posts'])).toEqual({ name: 'createPost', spaceId: 's1' });
    expect(matchSpacesRoute('GET', ['s1', 'posts', 'p9'])).toEqual({ name: 'getPost', spaceId: 's1', postId: 'p9' });
  });

  it('rejects unknown paths and wrong methods', () => {
    expect(matchSpacesRoute('GET', ['join'])).toEqual({ name: 'methodNotAllowed' });
    expect(matchSpacesRoute('PUT', ['s1'])).toEqual({ name: 'methodNotAllowed' });
    expect(matchSpacesRoute('GET', ['s1', 'nope'])).toEqual({ name: 'notFound' });
    expect(matchSpacesRoute('GET', ['s1', 'posts', 'p', 'x'])).toEqual({ name: 'notFound' });
  });
});
