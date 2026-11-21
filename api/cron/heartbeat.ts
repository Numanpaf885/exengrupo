/**
 * Daily keep-alive (vercel.json "crons"). Vercel calls this with
 * `Authorization: Bearer <CRON_SECRET>`. Updates the single row of
 * public.heartbeat so the free Supabase project never pauses.
 */
import { env } from '../../server/http';
import { touchHeartbeat } from '../../server/realtime';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'No autorizado.' }, { status: 401 });
  }
  try {
    const { column } = await touchHeartbeat(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), new Date().toISOString());
    return Response.json({ ok: true, column });
  } catch (e) {
    console.error('heartbeat failed:', e instanceof Error ? e.message : 'unknown');
    return Response.json({ ok: false }, { status: 500 });
  }
}
