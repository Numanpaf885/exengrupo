/** POST /api/auth/activate  { username, code, password } → 200 { token, user } (one-time code from the admin) */
import { activate } from '../../server/auth';
import { authDeps, readJson, respond } from '../../server/http';

export function POST(request: Request): Promise<Response> {
  return respond(async () => activate(authDeps(), await readJson(request)));
}
