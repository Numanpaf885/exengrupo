/** GET /api/auth/me  (Authorization: Bearer <token>) → 200 { user } */
import { me } from '../../server/auth';
import { authDeps, respond } from '../../server/http';

export function GET(request: Request): Promise<Response> {
  return respond(() => me(authDeps(), request.headers.get('authorization')));
}
