import { describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '../secretbox';
import { claudeProvider } from './claude';
import { buildProviders, providerViews, resolveProviders, testProviderKey } from './config';

const SECRET = 'test-secret';
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('resolveProviders', () => {
  it('prefers admin values over Vercel env over defaults, in the fixed order', () => {
    const settings = {
      groq_api_key: encryptSecret('groq-admin-key-1234', SECRET),
      groq_model: 'groq-admin-model',
    };
    const env = { GEMINI_API_KEY: 'gemini-env-key-5678', GROQ_API_KEY: 'groq-env', GEMINI_MODEL: 'gem-env-model' };
    const r = resolveProviders(settings, env, SECRET);
    expect(r.map((p) => p.id)).toEqual(['claude', 'gemini', 'groq', 'openrouter']);
    expect(r[0]).toMatchObject({ key: null, keySource: 'none', model: 'claude-opus-5-5', modelSource: 'default' });
    expect(r[1]).toMatchObject({ key: 'gemini-env-key-5678', keySource: 'vercel', model: 'gem-env-model', modelSource: 'vercel' });
    expect(r[2]).toMatchObject({ key: 'groq-admin-key-1234', keySource: 'admin', model: 'groq-admin-model', modelSource: 'admin' });
  });

  it('ignores a stored key it can no longer decrypt (secret changed)', () => {
    const settings = { gemini_api_key: encryptSecret('old', 'other-secret') };
    expect(resolveProviders(settings, {}, SECRET)[1]).toMatchObject({ key: null, keySource: 'none' });
  });

  it('builds only configured providers and never shows a full key', () => {
    const r = resolveProviders({}, { GEMINI_API_KEY: 'gemini-env-key-5678', OPENROUTER_API_KEY: 'or-key-abcdefgh' }, SECRET);
    expect(buildProviders(r)).toHaveLength(2);
    const views = providerViews(r);
    expect(views[1]).toMatchObject({ id: 'gemini', key_set: true, key_hint: '…5678', key_source: 'vercel' });
    expect(JSON.stringify(views)).not.toContain('gemini-env-key');
  });
});

describe('claudeProvider (mocked HTTP)', () => {
  it('sends the image + prompt with refusal fallbacks and reads the text', async () => {
    const fetchMock = vi.fn(async (_u: string, _i?: RequestInit) =>
      json({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [
          { type: 'thinking', thinking: '', signature: 's' },
          { type: 'text', text: '[{"n":1,"type":"mc","answer":"b"}]' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    );
    const res = await claudeProvider('sk-ant-test', 'claude-opus-5-5', 5000, fetchMock)('QUJD');
    expect(res).toMatchObject({ ok: true, provider: 'claude', text: '[{"n":1,"type":"mc","answer":"b"}]' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/messages');
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.fallbacks).toBe('default');
    expect(body.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } });
    expect(new Headers(init?.headers).get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
  });

  it('reports rate limits with retry-after and treats refusals as failures', async () => {
    const limited = vi.fn(async () => json({ type: 'error', error: { type: 'rate_limit_error', message: 'x' } }, 429, { 'retry-after': '20' }));
    expect(await claudeProvider('k', 'm', 5000, limited)('x')).toMatchObject({ ok: false, rateLimited: true, retryAfterSec: 20 });
    const refused = vi.fn(async () =>
      json({ id: 'm', type: 'message', role: 'assistant', model: 'm', content: [], stop_reason: 'refusal', usage: { input_tokens: 1, output_tokens: 0 } }),
    );
    expect(await claudeProvider('k', 'm', 5000, refused)('x')).toMatchObject({ ok: false, rateLimited: false });
  });
});

describe('testProviderKey (free endpoints, mocked)', () => {
  it('Gemini: model lookup', async () => {
    expect(await testProviderKey('gemini', 'k', 'm', vi.fn(async () => json({ name: 'models/m' })))).toMatchObject({ ok: true });
    expect(await testProviderKey('gemini', 'k', 'm', vi.fn(async () => json({}, 404)))).toMatchObject({ ok: false });
    expect(await testProviderKey('gemini', 'k', 'm', vi.fn(async () => json({}, 400)))).toEqual({ ok: false, message: 'Clave no válida.' });
  });

  it('Groq: key + model in the list', async () => {
    const f = vi.fn(async () => json({ data: [{ id: 'meta-llama/llama-4-scout-17b-16e-instruct' }] }));
    expect(await testProviderKey('groq', 'k', 'meta-llama/llama-4-scout-17b-16e-instruct', f)).toMatchObject({ ok: true });
    expect(await testProviderKey('groq', 'k', 'other', f)).toMatchObject({ ok: false });
    expect(await testProviderKey('groq', 'k', 'x', vi.fn(async () => json({}, 401)))).toEqual({ ok: false, message: 'Clave no válida.' });
  });

  it('OpenRouter: key endpoint then public model list', async () => {
    const f = vi.fn(async (url: string) => (url.endsWith('/key') ? json({ data: {} }) : json({ data: [{ id: 'g/m:free' }] })));
    expect(await testProviderKey('openrouter', 'k', 'g/m:free', f)).toMatchObject({ ok: true });
    expect(await testProviderKey('openrouter', 'k', 'gone:free', f)).toMatchObject({ ok: false });
  });

  it('Claude: model lookup via the SDK', async () => {
    const f = vi.fn(async () => json({ id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' }));
    expect(await testProviderKey('claude', 'sk-ant', 'claude-opus-5-5', f)).toMatchObject({ ok: true });
    const bad = vi.fn(async () => json({ type: 'error', error: { type: 'authentication_error', message: 'x' } }, 401));
    expect(await testProviderKey('claude', 'sk-ant', 'claude-opus-5-5', bad)).toEqual({ ok: false, message: 'Clave no válida.' });
  });
});
