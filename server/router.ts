/**
 * All /api/spaces/* routes go through ONE Vercel function (the Hobby plan
 * allows only 12 functions per deployment). vercel.json rewrites
 * /api/spaces/<path> to /api/spaces?__path=<path>.
 */
export type SpacesRoute =
  | { name: 'list' }
  | { name: 'create' }
  | { name: 'join' }
  | { name: 'get'; spaceId: string }
  | { name: 'rename'; spaceId: string }
  | { name: 'delete'; spaceId: string }
  | { name: 'removeMember'; spaceId: string; userId: string }
  | { name: 'listPosts'; spaceId: string }
  | { name: 'createPost'; spaceId: string }
  | { name: 'getPost'; spaceId: string; postId: string };

export type RouteMatch = SpacesRoute | { name: 'notFound' } | { name: 'methodNotAllowed' };

/** The path after /api/spaces, from the rewrite's __path query or the URL itself. */
export function spacesPath(url: URL): string[] {
  const raw = url.searchParams.get('__path') ?? url.pathname.replace(/^\/api\/spaces\/?/, '');
  return raw
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s));
}

export function matchSpacesRoute(method: string, seg: string[]): RouteMatch {
  const m = method.toUpperCase();
  const pick = (table: Record<string, SpacesRoute>): RouteMatch => table[m] ?? { name: 'methodNotAllowed' };
  const [a, b, c, d] = seg;
  if (seg.length === 0) return pick({ GET: { name: 'list' }, POST: { name: 'create' } });
  if (seg.length === 1 && a === 'join') return pick({ POST: { name: 'join' } });
  if (seg.length === 1) {
    return pick({
      GET: { name: 'get', spaceId: a },
      PATCH: { name: 'rename', spaceId: a },
      DELETE: { name: 'delete', spaceId: a },
    });
  }
  if (seg.length === 3 && b === 'members') return pick({ DELETE: { name: 'removeMember', spaceId: a, userId: c } });
  if (seg.length === 2 && b === 'posts') {
    return pick({ GET: { name: 'listPosts', spaceId: a }, POST: { name: 'createPost', spaceId: a } });
  }
  if (seg.length === 3 && b === 'posts') return pick({ GET: { name: 'getPost', spaceId: a, postId: c } });
  void d;
  return { name: 'notFound' };
}
