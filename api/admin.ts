/**
 * Admin panel API (see server/admin.ts and server/router.ts):
 *   POST   /api/admin/login                  { password } → { token }   (ADMIN_PASSWORD)
 *   GET    /api/admin/users                  users (never codes or hashes)
 *   POST   /api/admin/users                  { username } → one-time code (shown once)
 *   POST   /api/admin/users/:id/reset        new one-time code, signs the person out everywhere
 *   DELETE /api/admin/users/:id              delete account + remove from every space
 *   GET    /api/admin/keys                   AI providers (key hints only), order
 *   PUT    /api/admin/keys/:provider         { key?, model? } save ("" clears)
 *   POST   /api/admin/keys/:provider/test    { key?, model? } free check
 */
import { adminLogin, createUser, deleteUser, getKeys, listUsers, requireAdmin, resetUser, saveKey, testKey } from '../server/admin';
import type { Result } from '../server/auth';
import { adminDeps, readJson, respond } from '../server/http';
import { adminPath, matchAdminRoute } from '../server/router';

async function dispatch(request: Request): Promise<Result> {
  const route = matchAdminRoute(request.method, adminPath(new URL(request.url)));
  if (route.name === 'notFound') return { status: 404, body: { error: 'No encontrado.' } };
  if (route.name === 'methodNotAllowed') return { status: 405, body: { error: 'Método no permitido.' } };
  const deps = adminDeps();
  if (route.name === 'login') {
    const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    return adminLogin(deps, await readJson(request), ip);
  }
  const denied = requireAdmin(deps, request.headers.get('authorization'));
  if (denied) return denied;
  switch (route.name) {
    case 'listUsers':
      return listUsers(deps);
    case 'createUser':
      return createUser(deps, await readJson(request));
    case 'resetUser':
      return resetUser(deps, route.userId);
    case 'deleteUser':
      return deleteUser(deps, route.userId);
    case 'getKeys':
      return getKeys(deps);
    case 'saveKey':
      return saveKey(deps, route.provider, await readJson(request));
    case 'testKey':
      return testKey(deps, route.provider, await readJson(request));
  }
}

const handler = (request: Request): Promise<Response> => respond(() => dispatch(request));

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
