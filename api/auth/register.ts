/** POST /api/auth/register  { username, password } → 201 { token, user } */
import { register } from '../../server/auth';
import { authDeps, readJson, respond } from '../../server/http';

export function POST(request: Request): Promise<Response> {
  return respond(async () => register(authDeps(), await readJson(request)));
}
