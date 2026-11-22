import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { ProviderResult, VisionClient, VisionInput } from '../ai/providers';
import { createPost, type PostView } from '../posts';
import { FILE_READY, type FileRecord } from '../schema';
import { createSpace, joinSpace, type SpaceSummary } from '../spaces';
import { memoryStorage } from '../storage';
import { memoryTable } from '../table';
import { bearer, TEST_NOW, testDeps } from '../testing';
import { createFile, deleteFile, type FileDeps, type FileView, listFiles, processFile, type TextFile, uploadChunk } from './handlers';
import { analyzeWithReferences, loadSpaceChunks, TRANSCRIBE_PROMPT } from './refs';
import { FILE_LIMITS, FILE_MSG } from './types';

type Reply = (input: VisionInput) => ProviderResult;

function fakeClient(id: VisionClient['id'], pdf: boolean, reply: Reply, calls: VisionInput[] = []): VisionClient {
  return {
    id,
    model: `${id}-model`,
    pdf,
    call: async (input) => {
      calls.push(input);
      return reply(input);
    },
  };
}

const ok = (provider: string, text: string): ProviderResult => ({ ok: true, provider, model: `${provider}-model`, text });

async function setup(clients: VisionClient[] = []) {
  const base = testDeps([
    { id: 'ana', name: 'ana' },
    { id: 'luis', name: 'luis' },
    { id: 'eva', name: 'eva' },
    { id: 'mar', name: 'mar' },
  ]);
  const files = memoryTable<FileRecord>();
  const storage = memoryStorage();
  const deps: FileDeps = { ...base, files, storage, clients: async () => clients, log: () => undefined };
  const space = ((await createSpace(deps, bearer('ana'), { name: 'Física' })).body as { space: SpaceSummary }).space;
  await joinSpace(deps, bearer('luis'), { code: space.join_code });
  await joinSpace(deps, bearer('mar'), { code: space.join_code });
  return { deps, base, files, storage, space };
}

type Created = { file: FileView; upload: { token: string; chunk_bytes: number; chunks: number } };
type Processed = { file: FileView; done: boolean; next_step?: number; progress?: { done_pages: number; total_pages: number } };

/** create → send the pieces through /api → run every processing step. */
async function upload(ctx: Awaited<ReturnType<typeof setup>>, who: string, name: string, bytes: Uint8Array, chunkBytes?: number) {
  const created = await createFile(ctx.deps, bearer(who), ctx.space.space_id, { name, size: bytes.length });
  expect(created.status).toBe(201);
  const { file, upload: up } = created.body as Created;
  const size = chunkBytes ?? up.chunk_bytes;
  const count = Math.ceil(bytes.length / size);
  for (let i = 0; i < count; i++) {
    const res = await uploadChunk(ctx.deps, up.token, ctx.space.space_id, file.file_id, i, bytes.slice(i * size, (i + 1) * size));
    expect(res.status).toBe(200);
  }
  let step = 0;
  const steps: Processed[] = [];
  for (;;) {
    const res = await processFile(ctx.deps, bearer(who), ctx.space.space_id, file.file_id, { step, chunks: count });
    expect(res.status).toBe(200);
    const body = res.body as Processed;
    steps.push(body);
    if (body.done) return { file: body.file, steps };
    step = body.next_step!;
  }
}

const text = (s: string) => new TextEncoder().encode(s);

async function pdf(pages: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const t of pages) {
    const page = doc.addPage([400, 400]);
    if (t) page.drawText(t, { x: 20, y: 350, size: 12, font });
  }
  return doc.save();
}

describe('createFile', () => {
  it('creates a "procesando" row under refs/ and a presigned PUT URL', async () => {
    const ctx = await setup();
    const res = await createFile(ctx.deps, bearer('luis'), ctx.space.space_id, { name: 'Tema 3.PDF', size: 1234 });
    expect(res.status).toBe(201);
    const { file, upload: up } = res.body as Created;
    expect(file).toMatchObject({ name: 'Tema 3.PDF', type: 'pdf', status: 'procesando', can_delete: true, uploader: 'luis' });
    const row = ctx.files.rows[0];
    expect(row.file_key).toBe(`refs/${ctx.space.space_id}/${file.file_id}.pdf`);
    expect(row.text_key).toBe(`refs/${ctx.space.space_id}/${file.file_id}.chunks.json`);
    expect(row.file_key.startsWith('spaces/')).toBe(false);
    expect(up).toMatchObject({ chunk_bytes: 4_000_000, chunks: 1 });
    expect(up.token.startsWith('u1.')).toBe(true);
  });

  it('rejects other types, empty or too big files, non-members and a 21st file', async () => {
    const ctx = await setup();
    const id = ctx.space.space_id;
    expect((await createFile(ctx.deps, bearer('luis'), id, { name: 'a.exe', size: 5 })).body).toEqual({ error: FILE_MSG.badType });
    expect((await createFile(ctx.deps, bearer('luis'), id, { name: 'a.pdf', size: 0 })).body).toEqual({ error: FILE_MSG.empty });
    expect(
      (await createFile(ctx.deps, bearer('luis'), id, { name: 'a.pdf', size: FILE_LIMITS.maxBytes + 1 })).body,
    ).toEqual({ error: FILE_MSG.tooBig });
    expect((await createFile(ctx.deps, bearer('eva'), id, { name: 'a.pdf', size: 5 })).status).toBe(404);
    for (let i = 0; i < 20; i++) await createFile(ctx.deps, bearer('luis'), id, { name: `f${i}.txt`, size: 5 });
    expect((await createFile(ctx.deps, bearer('luis'), id, { name: 'x.txt', size: 5 })).body).toEqual({ error: FILE_MSG.tooMany });
  });
});

describe('processFile', () => {
  it('reads .md as is and becomes "listo" with chunks in R2', async () => {
    const ctx = await setup();
    const { file } = await upload(ctx, 'luis', 'apuntes.md', text('# Tema 1\n\nLa presión se mide en pascales.'));
    expect(file).toMatchObject({ status: FILE_READY, pages: 1, error: '' });
    const stored = JSON.parse(new TextDecoder().decode(ctx.storage.objects.get(ctx.files.rows[0].text_key)!)) as TextFile;
    expect(stored).toEqual({ v: 1, name: 'apuntes.md', chunks: [{ page: null, text: '# Tema 1\nLa presión se mide en pascales.' }] });
  });

  it('extracts a PDF text layer page by page', async () => {
    const ctx = await setup();
    const { file } = await upload(ctx, 'luis', 'libro.pdf', await pdf([
      'Capitulo uno: la presion atmosferica normal es de 101325 pascales.',
      'Capitulo dos: la fotosintesis ocurre en los cloroplastos de la hoja.',
    ]));
    expect(file).toMatchObject({ status: FILE_READY, pages: 2 });
    const stored = JSON.parse(new TextDecoder().decode(ctx.storage.objects.get(ctx.files.rows[0].text_key)!)) as TextFile;
    expect('chunks' in stored && stored.chunks.map((c) => c.page)).toEqual([1, 2]);
    expect('chunks' in stored && stored.chunks[1].text).toContain('fotosintesis');
  });

  it('OCRs a scanned PDF 3 pages per step with a PDF-capable AI, keeping page numbers', async () => {
    const calls: VisionInput[] = [];
    const groq = fakeClient('groq', false, () => ok('groq', 'never used'));
    const gemini = fakeClient('gemini', true, (input) => {
      expect(input.mime).toBe('application/pdf');
      const n = calls.length;
      return ok('gemini', `=== Página 1 ===\nTexto escaneado parte ${n} uno\n=== Página 2 ===\nparte ${n} dos`);
    }, calls);
    const ctx = await setup([groq, gemini]);
    const { file, steps } = await upload(ctx, 'luis', 'escaneado.pdf', await pdf(['', '', '', '']));
    expect(file).toMatchObject({ status: FILE_READY, pages: 4 });
    expect(steps.map((s) => s.done)).toEqual([false, true]);
    expect(steps[0].progress).toEqual({ done_pages: 2, total_pages: 4 });
    expect(calls).toHaveLength(2);
    const stored = JSON.parse(new TextDecoder().decode(ctx.storage.objects.get(ctx.files.rows[0].text_key)!)) as TextFile;
    expect('chunks' in stored && stored.chunks.map((c) => c.page)).toEqual([1, 2, 4, 4]);
  });

  it('refuses scanned PDFs over 30 pages and needs Claude or Gemini for scanned PDFs', async () => {
    const ctx = await setup([fakeClient('groq', false, () => ok('groq', 'x'))]);
    const long = await upload(ctx, 'luis', 'largo.pdf', await pdf(Array(31).fill('')));
    expect(long.file).toMatchObject({ status: 'error', error: 'PDF escaneado demasiado largo: súbelo en partes' });
    const short = await upload(ctx, 'luis', 'corto.pdf', await pdf(['']));
    expect(short.file).toMatchObject({ status: 'error', error: FILE_MSG.noPdfAi });
  });

  it('OCRs an image with any vision AI', async () => {
    const ctx = await setup([fakeClient('groq', false, () => ok('groq', 'Teorema de Pitágoras: a² + b² = c²'))]);
    const { file } = await upload(ctx, 'luis', 'pizarra.jpg', new Uint8Array([0xff, 0xd8, 0xff, 1]));
    expect(file).toMatchObject({ status: FILE_READY, pages: 1 });
  });

  it('never stays stuck: missing upload, unreadable file, AI out of quota, stale rows', async () => {
    const limited = fakeClient('gemini', true, () => ({
      ok: false, provider: 'gemini', model: 'm', rateLimited: true, retryAfterSec: 120, error: 'rate limited',
    }));
    const ctx = await setup([limited]);
    const created = (await createFile(ctx.deps, bearer('luis'), ctx.space.space_id, { name: 'nada.txt', size: 3 })).body as Created;
    const missing = await processFile(ctx.deps, bearer('luis'), ctx.space.space_id, created.file.file_id, {});
    expect((missing.body as Processed).file).toMatchObject({ status: 'error', error: FILE_MSG.notUploaded });

    const broken = await upload(ctx, 'luis', 'roto.docx', text('not a zip'));
    expect(broken.file).toMatchObject({ status: 'error', error: FILE_MSG.unreadable });

    const quota = await upload(ctx, 'luis', 'foto.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    expect(quota.file).toMatchObject({ status: 'error', error: 'Límite de IA alcanzado, prueba en 2 min' });

    await ctx.files.append({ ...ctx.files.rows[0], file_id: 'old', status: 'procesando', created_at: new Date(TEST_NOW - FILE_LIMITS.staleMs - 1).toISOString() });
    const list = (await listFiles(ctx.deps, bearer('ana'), ctx.space.space_id)).body as { files: FileView[] };
    expect(list.files.find((f) => f.file_id === 'old')).toMatchObject({ status: 'error', error: FILE_MSG.stale });
  });
});

describe('uploads through /api in pieces', () => {
  it('joins the pieces in order, removes them, and the file is read normally', async () => {
    const ctx = await setup();
    const body = 'La presión se mide en pascales. '.repeat(40);
    const { file } = await upload(ctx, 'luis', 'largo.txt', text(body), 100);
    expect(file).toMatchObject({ status: FILE_READY });
    const row = ctx.files.rows[0];
    expect(new TextDecoder().decode(ctx.storage.objects.get(row.file_key)!)).toBe(body);
    expect([...ctx.storage.objects.keys()].some((k) => k.includes('.part'))).toBe(false);
  });

  it('rejects a bad or foreign token, a bad index and an oversized piece, with no Sheet reads', async () => {
    const ctx = await setup();
    const created = (await createFile(ctx.deps, bearer('luis'), ctx.space.space_id, { name: 'a.txt', size: 5 })).body as Created;
    const other = (await createFile(ctx.deps, bearer('luis'), ctx.space.space_id, { name: 'b.txt', size: 5 })).body as Created;
    const id = ctx.space.space_id;
    const f = created.file.file_id;
    const piece = text('hola');
    expect((await uploadChunk(ctx.deps, 'u1.x.y', id, f, 0, piece)).body).toEqual({ error: FILE_MSG.badUpload });
    expect((await uploadChunk(ctx.deps, other.upload.token, id, f, 0, piece)).status).toBe(403);
    expect((await uploadChunk(ctx.deps, created.upload.token, 'otro', f, 0, piece)).status).toBe(403);
    expect((await uploadChunk(ctx.deps, created.upload.token, id, f, -1, piece)).body).toEqual({ error: FILE_MSG.badChunk });
    expect((await uploadChunk(ctx.deps, created.upload.token, id, f, FILE_LIMITS.maxChunks, piece)).status).toBe(400);
    expect((await uploadChunk(ctx.deps, created.upload.token, id, f, 0, new Uint8Array(FILE_LIMITS.chunkBytes + 1))).status).toBe(400);
    expect((await uploadChunk(ctx.deps, created.upload.token, id, f, 0, new Uint8Array(0))).status).toBe(400);
    expect((await uploadChunk(ctx.deps, created.upload.token, id, f, 0, piece)).status).toBe(200);
  });

  it('says the file did not arrive when a piece is missing', async () => {
    const ctx = await setup();
    const created = (await createFile(ctx.deps, bearer('luis'), ctx.space.space_id, { name: 'a.txt', size: 8 })).body as Created;
    await uploadChunk(ctx.deps, created.upload.token, ctx.space.space_id, created.file.file_id, 0, text('hola'));
    const res = await processFile(ctx.deps, bearer('luis'), ctx.space.space_id, created.file.file_id, { step: 0, chunks: 2 });
    expect((res.body as Processed).file).toMatchObject({ status: 'error', error: FILE_MSG.notUploaded });
  });
});

describe('deleteFile', () => {
  it('lets the uploader or the creator delete (soft delete + R2 cleanup), nobody else', async () => {
    const ctx = await setup();
    const { file } = await upload(ctx, 'luis', 'a.txt', text('hola mundo de la física'));
    const row = ctx.files.rows[0];
    expect((await deleteFile(ctx.deps, bearer('mar'), ctx.space.space_id, file.file_id)).body).toEqual({ error: FILE_MSG.notAllowed });
    const views = (await listFiles(ctx.deps, bearer('mar'), ctx.space.space_id)).body as { files: FileView[] };
    expect(views.files[0].can_delete).toBe(false);
    expect((await deleteFile(ctx.deps, bearer('ana'), ctx.space.space_id, file.file_id)).status).toBe(200);
    expect(ctx.files.rows[0].deleted).toBe('TRUE');
    expect(ctx.storage.objects.has(row.file_key)).toBe(false);
    expect(ctx.storage.objects.has(row.text_key)).toBe(false);
    expect(((await listFiles(ctx.deps, bearer('ana'), ctx.space.space_id)).body as { files: FileView[] }).files).toEqual([]);
  });
});

describe('end to end (mocked): upload → listo → a photo answer uses the chunk', () => {
  it('transcribes, searches, adds the reference to both answer calls and logs it in models', async () => {
    const prompts: Record<string, string[]> = { claude: [], gemini: [] };
    const make = (id: 'claude' | 'gemini', answer: string) =>
      fakeClient(id, true, (input) => {
        if (input.prompt === TRANSCRIBE_PROMPT) return ok(id, '1. ¿Cuál es la presión atmosférica normal? a) 1 Pa b) 101.325 Pa');
        prompts[id].push(input.prompt);
        return ok(id, answer);
      });
    const clients = [make('claude', '[{"n":1,"type":"mc","answer":"b"}]'), make('gemini', '[{"n":1,"type":"mc","answer":"b"}]')];
    const ctx = await setup(clients);
    await upload(ctx, 'luis', 'apuntes.txt', text('Tema 2. La presion atmosferica normal al nivel del mar es 101.325 Pa.\n\nTema 9. La mitosis tiene cuatro fases.'));

    const post = await createPost(
      {
        ...ctx.base,
        storage: ctx.storage,
        broadcast: async () => undefined,
        log: () => undefined,
        analyze: (b64, spaceId) =>
          analyzeWithReferences(b64, { clients, chunks: () => loadSpaceChunks(ctx.files, ctx.storage, spaceId) }),
      },
      bearer('mar'),
      ctx.space.space_id,
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1]),
    );
    expect(post.status).toBe(201);
    expect((post.body as { post: PostView }).post.answer).toBe('1.b');
    for (const id of ['claude', 'gemini'] as const) {
      expect(prompts[id]).toHaveLength(1);
      expect(prompts[id][0]).toContain('Referencia del espacio');
      expect(prompts[id][0]).toContain('[apuntes.txt]');
      expect(prompts[id][0]).toContain('101.325 Pa');
      expect(prompts[id][0]).toContain('sigue la referencia');
    }
    expect(ctx.base.posts.rows[0].models).toBe('claude:claude-model, gemini:gemini-model | ref: apuntes.txt');
  });

  it('skips the transcription call when the space has no ready files', async () => {
    const calls: VisionInput[] = [];
    const client = fakeClient('gemini', true, () => ok('gemini', '[{"n":1,"type":"tf","answer":"V"}]'), calls);
    const outcome = await analyzeWithReferences('AAAA', { clients: [client], chunks: async () => [] });
    expect(outcome).toEqual({ status: 'done', answer: '1.V', models: 'gemini:gemini-model' });
    expect(calls).toHaveLength(1);
    expect(calls[0].prompt).not.toContain('Referencia');
  });
});
