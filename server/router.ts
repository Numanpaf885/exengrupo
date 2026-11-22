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
  | { name: 'getPost'; spaceId: string; postId: string }
  | { name: 'listFiles'; spaceId: string }
  | { name: 'createFile'; spaceId: string }
  | { name: 'processFile'; spaceId: string; fileId: string }
  | { name: 'deleteFile'; spaceId: string; fileId: string }
  | { name: 'uploadChunk'; spaceId: string; fileId: string; index: number };

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
  if (seg.length === 2 && b === 'files') {
    return pick({ GET: { name: 'listFiles', spaceId: a }, POST: { name: 'createFile', spaceId: a } });
  }
  if (seg.length === 3 && b === 'files') return pick({ DELETE: { name: 'deleteFile', spaceId: a, fileId: c } });
  if (seg.length === 5 && b === 'files' && d === 'chunks') {
    return pick({ PUT: { name: 'uploadChunk', spaceId: a, fileId: c, index: Number(seg[4]) } });
  }
  if (seg.length === 4 && b === 'files' && d === 'process') {
    return pick({ POST: { name: 'processFile', spaceId: a, fileId: c } });
  }
  return { name: 'notFound' };
}

/** /api/admin/* routes (one Vercel function, rewritten like /api/spaces). */
export type AdminRoute =
  | { name: 'login' }
  | { name: 'listUsers' }
  | { name: 'createUser' }
  | { name: 'resetUser'; userId: string }
  | { name: 'deleteUser'; userId: string }
  | { name: 'getKeys' }
  | { name: 'saveKey'; provider: string }
  | { name: 'testKey'; provider: string };

export function adminPath(url: URL): string[] {
  const raw = url.searchParams.get('__path') ?? url.pathname.replace(/^\/api\/admin\/?/, '');
  return raw.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
}

export function matchAdminRoute(method: string, seg: string[]): AdminRoute | { name: 'notFound' } | { name: 'methodNotAllowed' } {
  const m = method.toUpperCase();
  const pick = (table: Record<string, AdminRoute>) => table[m] ?? ({ name: 'methodNotAllowed' } as const);
  const [a, b, c] = seg;
  if (seg.length === 1 && a === 'login') return pick({ POST: { name: 'login' } });
  if (seg.length === 1 && a === 'users') return pick({ GET: { name: 'listUsers' }, POST: { name: 'createUser' } });
  if (seg.length === 2 && a === 'users') return pick({ DELETE: { name: 'deleteUser', userId: b } });
  if (seg.length === 3 && a === 'users' && c === 'reset') return pick({ POST: { name: 'resetUser', userId: b } });
  if (seg.length === 1 && a === 'keys') return pick({ GET: { name: 'getKeys' } });
  if (seg.length === 2 && a === 'keys') return pick({ PUT: { name: 'saveKey', provider: b } });
  if (seg.length === 3 && a === 'keys' && c === 'test') return pick({ POST: { name: 'testKey', provider: b } });
  return { name: 'notFound' };
}
