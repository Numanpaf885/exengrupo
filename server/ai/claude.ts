/**
 * Claude (Anthropic) as a vision provider, through the official SDK.
 * Default model claude-opus-5-5 (override with CLAUDE_MODEL or the admin panel).
 * Server-side refusal fallbacks are on ("default" routing), so a policy decline
 * is retried on a fallback Claude model inside the same call.
 */
import Anthropic from '@anthropic-ai/sdk';
import { PROMPT } from './answers';
import { answerProvider, type FetchLike, type Provider, type ProviderResult, type VisionClient, type VisionInput } from './providers';
import { retryAfterHeaderSeconds } from './retry';

export function claudeClient(key: string, model: string, timeoutMs: number, fetchImpl?: FetchLike): VisionClient {
  const client = new Anthropic({
    apiKey: key,
    timeout: timeoutMs,
    maxRetries: 0, // our own fallback order takes over instead of retrying
    ...(fetchImpl ? { fetch: fetchImpl as unknown as typeof fetch } : {}),
  });
  const call = async ({ prompt, mime, data, timeoutMs: perCall }: VisionInput): Promise<ProviderResult> => {
    const fail = (error: string, rateLimited = false, retryAfterSec?: number): ProviderResult => ({
      ok: false,
      provider: 'claude',
      model,
      rateLimited,
      retryAfterSec,
      error,
    });
    try {
      const media =
        mime === 'application/pdf'
          ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } } as const)
          : ({ type: 'image', source: { type: 'base64', media_type: mime, data } } as const);
      const response = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        messages: [
          {
            role: 'user',
            content: [media, { type: 'text', text: prompt }],
          },
        ],
      }, perCall ? { timeout: perCall } : undefined);
      if (response.stop_reason === 'refusal') return fail('refused');
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return text ? { ok: true, provider: 'claude', model: response.model || model, text } : fail('empty reply');
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) {
        return fail('rate limited', true, retryAfterHeaderSeconds(e.headers?.get('retry-after') ?? null, Date.now()));
      }
      if (e instanceof Anthropic.APIError) return fail(`HTTP ${e.status ?? '?'}`);
      return fail(e instanceof Error ? e.name : 'error');
    }
  };
  return { id: 'claude', model, pdf: true, call };
}

export const claudeProvider = (key: string, model: string, timeoutMs: number, fetchImpl?: FetchLike): Provider =>
  answerProvider(claudeClient(key, model, timeoutMs, fetchImpl), PROMPT);

/** Free key check: looks up the model (no tokens are used). */
export async function testClaudeKey(key: string, model: string, fetchImpl?: FetchLike): Promise<{ ok: boolean; message: string }> {
  const client = new Anthropic({
    apiKey: key,
    timeout: 10_000,
    maxRetries: 0,
    ...(fetchImpl ? { fetch: fetchImpl as unknown as typeof fetch } : {}),
  });
  try {
    await client.models.retrieve(model);
    return { ok: true, message: `Clave válida. Modelo ${model} disponible.` };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, message: 'Clave no válida.' };
    }
    if (e instanceof Anthropic.NotFoundError) return { ok: false, message: `La clave funciona, pero el modelo ${model} no existe.` };
    if (e instanceof Anthropic.RateLimitError) return { ok: true, message: 'Clave válida (límite de uso alcanzado ahora mismo).' };
    return { ok: false, message: 'No se pudo comprobar. Prueba de nuevo.' };
  }
}
