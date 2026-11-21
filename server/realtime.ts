/**
 * Supabase Realtime Broadcast from the server over REST:
 *   POST {SUPABASE_URL}/realtime/v1/api/broadcast/{topic}/events/{event}
 * with the secret key in the `apikey` header (Supabase docs: secret/publishable
 * keys go on `apikey`, NOT `Authorization: Bearer`, because they aren't JWTs).
 * The payload is ONLY { post_id } — answer text never goes through Supabase.
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const NEW_POST_EVENT = 'post';

export type Broadcaster = (channelId: string, postId: string) => Promise<void>;

export function supabaseBroadcaster(supabaseUrl: string, secretKey: string, fetchImpl: FetchLike = fetch): Broadcaster {
  const base = supabaseUrl.replace(/\/+$/, '');
  return async (channelId, postId) => {
    const res = await fetchImpl(
      `${base}/realtime/v1/api/broadcast/${encodeURIComponent(channelId)}/events/${NEW_POST_EVENT}`,
      {
        method: 'POST',
        headers: { apikey: secretKey, 'content-type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      },
    );
    if (!res.ok) throw new Error(`Broadcast failed (${res.status})`);
  };
}

/** Keep-alive: touch the single row of public.heartbeat via PostgREST. */
export interface HeartbeatPlan {
  filter: string;
  patch: Record<string, unknown>;
}

/**
 * The table's exact columns aren't fixed by the brief, so look at the row:
 * filter on `id` (or the first column) and set the first timestamp-like column
 * to now; with no such column, rewrite the key to itself (still an UPDATE).
 */
export function planHeartbeat(row: Record<string, unknown>, nowIso: string): HeartbeatPlan | null {
  const keys = Object.keys(row);
  if (keys.length === 0) return null;
  const idKey = keys.includes('id') ? 'id' : keys[0];
  const idValue = row[idKey];
  if (idValue === null || idValue === undefined) return null;
  const others = keys.filter((k) => k !== idKey);
  const tsKey =
    others.find((k) => /(ping|beat|last|updated|touched|seen)/i.test(k)) ??
    others.find((k) => !/created/i.test(k) && /(_at$|time|date)/i.test(k));
  return {
    filter: `${encodeURIComponent(idKey)}=eq.${encodeURIComponent(String(idValue))}`,
    patch: tsKey ? { [tsKey]: nowIso } : { [idKey]: idValue },
  };
}

export async function touchHeartbeat(
  supabaseUrl: string,
  secretKey: string,
  nowIso: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ column: string }> {
  const base = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/heartbeat`;
  const headers = { apikey: secretKey, 'content-type': 'application/json' };
  const read = await fetchImpl(`${base}?select=*&limit=1`, { headers });
  if (!read.ok) throw new Error(`Heartbeat read failed (${read.status})`);
  const rows = (await read.json()) as Array<Record<string, unknown>>;
  const plan = rows[0] ? planHeartbeat(rows[0], nowIso) : null;
  if (!plan) throw new Error('public.heartbeat has no usable row');
  const write = await fetchImpl(`${base}?${plan.filter}`, {
    method: 'PATCH',
    headers: { ...headers, prefer: 'return=minimal' },
    body: JSON.stringify(plan.patch),
  });
  if (!write.ok) throw new Error(`Heartbeat update failed (${write.status})`);
  return { column: Object.keys(plan.patch)[0] };
}
