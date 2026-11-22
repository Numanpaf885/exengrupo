import { describe, expect, it, vi } from 'vitest';
import { analyzePhoto } from './analyze';
import { geminiProvider, groqProvider, openRouterProvider, type Provider, type ProviderResult } from './providers';

const ok = (provider: string, text: string): Provider => async () => ({ ok: true, provider, model: `${provider}-m`, text });
const limited = (provider: string, retryAfterSec?: number): Provider => async () => ({
  ok: false,
  provider,
  model: `${provider}-m`,
  rateLimited: true,
  retryAfterSec,
  error: 'rate limited',
});
const broken = (provider: string): Provider => async () => ({
  ok: false,
  provider,
  model: `${provider}-m`,
  rateLimited: false,
  error: 'HTTP 500',
});

const G = '[{"n":1,"type":"mc","answer":"a"},{"n":2,"type":"mc","answer":"b"}]';
const Q = '[{"n":1,"type":"mc","answer":"a"},{"n":2,"type":"mc","answer":"c"}]';
const O = '[{"n":1,"type":"mc","answer":"d"}]';

describe('analyzePhoto (preference order, 2 at a time)', () => {
  it('merges the two most preferred providers', async () => {
    const third = vi.fn(ok('groq', O));
    const out = await analyzePhoto([ok('claude', G), ok('gemini', Q), third], 'b64');
    expect(out).toEqual({
      status: 'done',
      answer: '1.a  2.b/c ?',
      models: 'claude:claude-m, gemini:gemini-m | by 1:claude+gemini 2:claude=b,gemini=c',
    });
    expect(third).not.toHaveBeenCalled();
  });

  it('replaces a failed provider with the next one in the order', async () => {
    const fb = vi.fn(ok('groq', O));
    const out = await analyzePhoto([ok('claude', G), limited('gemini', 30), fb], 'b64');
    expect(out.answer).toBe('1.a/d ?  2.b');
    expect(out.models.split(' | ')[0]).toBe('claude:claude-m, groq:groq-m');
    expect(fb).toHaveBeenCalledTimes(1);
  });

  it('fills both slots from the queue when both favourites fail', async () => {
    const out = await analyzePhoto([broken('claude'), limited('gemini'), ok('groq', G), ok('openrouter', O)], 'b64');
    expect(out).toMatchObject({ status: 'done', answer: '1.a/d ?  2.b' });
    expect(out.models.split(' | ')[0]).toBe('groq:groq-m, openrouter:openrouter-m');
  });

  it('keeps going down the list until one works', async () => {
    const out = await analyzePhoto([ok('gemini', G), broken('groq'), broken('openrouter'), ok('claude', O)], 'b64');
    expect(out.models.split(' | ')[0]).toBe('gemini:gemini-m, claude:claude-m');
  });

  it('treats a reply that is not JSON as a failure and falls back', async () => {
    const out = await analyzePhoto([ok('gemini', 'Lo siento'), ok('groq', Q), ok('openrouter', O)], 'b64');
    expect(out).toMatchObject({ status: 'done', answer: '1.d/a ?  2.c' });
    expect(out.models.split(' | ')[0]).toBe('openrouter:openrouter-m, groq:groq-m');
  });

  it('works with a single configured provider', async () => {
    expect(await analyzePhoto([ok('groq', Q)], 'b64')).toEqual({ status: 'done', answer: '1.a  2.c', models: 'groq:groq-m | by 1:groq 2:groq' });
  });

  it('starts no new fallback after the deadline', async () => {
    const fb = vi.fn(ok('openrouter', O));
    const out = await analyzePhoto([broken('gemini'), broken('groq'), fb], 'b64', { fallbackDeadline: 100, now: () => 200 });
    expect(fb).not.toHaveBeenCalled();
    expect(out.status).toBe('error');
  });

  it('reports the quota message with the shortest retry time', async () => {
    const out = await analyzePhoto([limited('gemini', 200), limited('groq'), limited('openrouter', 61)], 'b64');
    expect(out).toEqual({ status: 'error', answer: 'Límite de IA alcanzado, prueba en 2 min', models: '' });
  });

  it('defaults to 5 minutes when no provider says when to retry', async () => {
    const out = await analyzePhoto([limited('gemini'), limited('groq')], 'b64');
    expect(out.answer).toBe('Límite de IA alcanzado, prueba en 5 min');
  });

  it('says the photo is unreadable when models answer []', async () => {
    const out = await analyzePhoto([ok('gemini', '[]'), ok('groq', '[]')], 'b64');
    expect(out).toMatchObject({ status: 'error', answer: 'No se lee bien, repite la foto' });
  });

  it('gives a generic error when nothing works and it is not a quota problem', async () => {
    const out = await analyzePhoto([broken('gemini'), limited('groq'), broken('openrouter')], 'b64');
    expect(out).toMatchObject({ status: 'error', answer: 'No se pudo analizar la foto. Prueba de nuevo.' });
  });

  it('errors clearly when no provider has a key', async () => {
    expect(await analyzePhoto([], 'b64')).toMatchObject({ status: 'error' });
  });
});

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('provider requests (mocked fetch)', () => {
  it('Gemini: inline JPEG, JSON mode, key in header, text from candidates', async () => {
    const fetchMock = vi.fn(async (_u: string, _i?: RequestInit) =>
      json({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: G }] } }] }),
    );
    const res = (await geminiProvider('KEY', 'gemini-x', fetchMock)('QUJD')) as ProviderResult & { ok: true };
    expect(res).toMatchObject({ ok: true, text: G });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('KEY');
    const body = JSON.parse(String(init?.body));
    expect(body.contents[0].parts[1]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } });
    expect(body.generationConfig.response_mime_type).toBe('application/json');
  });

  it('Gemini: 429 reads RetryInfo', async () => {
    const fetchMock = vi.fn(async () =>
      json({ error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '45s' }] } }, 429),
    );
    expect(await geminiProvider('K', 'm', fetchMock)('x')).toMatchObject({ ok: false, rateLimited: true, retryAfterSec: 45 });
  });

  it('Groq: OpenAI-style image data URL and Bearer key; 429 reads Retry-After', async () => {
    const fetchMock = vi.fn(async (_u: string, _i?: RequestInit) => json({ choices: [{ message: { content: Q } }] }));
    expect(await groqProvider('GK', 'llama', fetchMock)('QUJD')).toMatchObject({ ok: true, text: Q });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer GK');
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('llama');
    expect(body.messages[0].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } });

    const limitedFetch = vi.fn(async () => json({ error: 'slow down' }, 429, { 'retry-after': '12' }));
    expect(await groqProvider('GK', 'llama', limitedFetch)('x')).toMatchObject({ rateLimited: true, retryAfterSec: 12 });
  });

  it('OpenRouter: right endpoint; network errors become failures', async () => {
    const fetchMock = vi.fn(async (_u: string, _i?: RequestInit) => json({ choices: [{ message: { content: O } }] }));
    await openRouterProvider('OK', 'm:free', fetchMock)('x');
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await openRouterProvider('OK', 'm:free', down)('x')).toMatchObject({ ok: false, rateLimited: false });
  });
});
