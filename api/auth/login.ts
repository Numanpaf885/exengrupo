/** POST /api/auth/login  { username, password } → 200 { token, user } */
import { login } from '../../server/auth';
import { authDeps, readJson, respond } from '../../server/http';

export function POST(request: Request): Promise<Response> {
  return respond(async () => login(authDeps(), await readJson(request)));
}
