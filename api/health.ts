/** GET /api/health — confirms the Vercel functions are deployed. No secrets, no services. */
export function GET(): Response {
  return Response.json({ ok: true, app: 'exengrupo' });
}
