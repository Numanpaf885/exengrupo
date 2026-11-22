/**
 * Reference files of a space. The phone uploads straight to R2 with a presigned
 * PUT (files can exceed Vercel's 4.5 MB body limit), then drives processing one
 * step at a time: "procesando" → "listo" or "error". Any member can add; the
 * uploader or the space creator can delete. Files are AI-only: nobody can open
 * or download them through the app.
 */
import type { Result } from '../auth';
import { authenticate, type DataDeps, fail, isResult, iso, membership } from '../context';
import type { VisionClient } from '../ai/providers';
import { FILE_ERROR, FILE_PROCESSING, FILE_READY, type FileRecord } from '../schema';
import { type ObjectStorage, refFileKey, refTextKey } from '../storage';
import { FALSE, isTrue, type Table, TRUE } from '../table';
import { chunkPages, type PageText } from './chunk';
import { extractStep, FileError } from './extract';
import { FILE_LIMITS, FILE_MSG, fileType } from './types';

export interface FileDeps extends DataDeps {
  files: Table<FileRecord>;
  storage: ObjectStorage;
  /** Configured vision providers in preference order (for OCR). */
  clients: () => Promise<VisionClient[]>;
  log: (message: string) => void;
}

/** What R2 holds at text_key: the final chunks, or OCR pages collected so far. */
export type TextFile = { v: 1; name: string; chunks: ReturnType<typeof chunkPages> } | { v: 1; partial: true; texts: PageText[] };

export interface FileView {
  file_id: string;
  name: string;
  type: string;
  pages: number | null;
  size_bytes: number;
  status: string;
  error: string;
  created_at: string;
  uploader: string;
  can_delete: boolean;
}

const isStale = (f: FileRecord, now: number) =>
  f.status === FILE_PROCESSING && now - Date.parse(f.created_at) > FILE_LIMITS.staleMs;

function toView(f: FileRecord, viewer: string, isCreator: boolean, names: Map<string, string>, now: number): FileView {
  const stale = isStale(f, now);
  return {
    file_id: f.file_id,
    name: f.name,
    type: f.type,
    pages: f.pages ? Number(f.pages) : null,
    size_bytes: Number(f.size_bytes) || 0,
    status: stale ? FILE_ERROR : f.status,
    error: stale ? FILE_MSG.stale : f.error,
    created_at: f.created_at,
    uploader: names.get(f.user_id) ?? '—',
    can_delete: isCreator || f.user_id === viewer,
  };
}

async function readFiles(deps: FileDeps) {
  try {
    return await deps.files.list();
  } catch (e) {
    deps.log(`files tab: ${e instanceof Error ? e.message : 'error'}`);
    return null;
  }
}

async function context(deps: FileDeps, auth: string | null, spaceId: string) {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const m = await membership(deps, spaceId, session.sub);
  if (isResult(m)) return m;
  return { session, m };
}

async function names(deps: FileDeps) {
  const users = await deps.users.list();
  return new Map(users.map((u) => [u.value.user_id, u.value.username]));
}

export async function listFiles(deps: FileDeps, auth: string | null, spaceId: string): Promise<Result> {
  const ctx = await context(deps, auth, spaceId);
  if (isResult(ctx)) return ctx;
  const rows = await readFiles(deps);
  if (!rows) return fail(500, FILE_MSG.noTab);
  const who = await names(deps);
  const now = deps.now();
  const files = rows
    .map((r) => r.value)
    .filter((f) => f.space_id === spaceId && !isTrue(f.deleted))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((f) => toView(f, ctx.session.sub, ctx.m.isCreator, who, now));
  return { status: 200, body: { files, limits: { max_files: FILE_LIMITS.maxFilesPerSpace, max_bytes: FILE_LIMITS.maxBytes } } };
}

/** POST { name, size } → a "procesando" row and a presigned PUT URL for the bytes. */
export async function createFile(deps: FileDeps, auth: string | null, spaceId: string, body: unknown): Promise<Result> {
  const ctx = await context(deps, auth, spaceId);
  if (isResult(ctx)) return ctx;
  const input = (body ?? {}) as { name?: unknown; size?: unknown };
  const name = typeof input.name === 'string' ? input.name.trim().replace(/[\\/]/g, '_').slice(0, 120) : '';
  const size = typeof input.size === 'number' ? input.size : Number(input.size);
  if (!name) return fail(400, FILE_MSG.badName);
  const type = fileType(name);
  if (!type) return fail(415, FILE_MSG.badType);
  if (!Number.isFinite(size) || size <= 0) return fail(400, FILE_MSG.empty);
  if (size > FILE_LIMITS.maxBytes) return fail(413, FILE_MSG.tooBig);

  const rows = await readFiles(deps);
  if (!rows) return fail(500, FILE_MSG.noTab);
  const active = rows.filter((r) => r.value.space_id === spaceId && !isTrue(r.value.deleted)).length;
  if (active >= FILE_LIMITS.maxFilesPerSpace) return fail(409, FILE_MSG.tooMany);

  const fileId = deps.newId();
  const record: FileRecord = {
    file_id: fileId,
    space_id: spaceId,
    user_id: ctx.session.sub,
    name,
    type: type.ext,
    file_key: refFileKey(spaceId, fileId, type.ext),
    text_key: refTextKey(spaceId, fileId),
    size_bytes: String(Math.round(size)),
    pages: '',
    status: FILE_PROCESSING,
    error: '',
    created_at: iso(deps),
    deleted: FALSE,
  };
  await deps.files.append(record);
  const url = await deps.storage.presignPut(record.file_key, type.mime, FILE_LIMITS.uploadUrlSeconds);
  const who = new Map([[ctx.session.sub, ctx.session.usr]]);
  return {
    status: 201,
    body: {
      file: toView(record, ctx.session.sub, ctx.m.isCreator, who, deps.now()),
      upload: { url, method: 'PUT', headers: { 'content-type': type.mime } },
    },
  };
}

async function findFile(deps: FileDeps, spaceId: string, fileId: string) {
  const rows = await readFiles(deps);
  return rows?.find((r) => r.value.file_id === fileId && r.value.space_id === spaceId && !isTrue(r.value.deleted)) ?? null;
}

const encode = (v: TextFile) => new TextEncoder().encode(JSON.stringify(v));

/**
 * POST { step } → runs one processing step. Returns { file, done, next_step }.
 * Every failure ends as status "error" with a Spanish message (never stuck).
 */
export async function processFile(
  deps: FileDeps,
  auth: string | null,
  spaceId: string,
  fileId: string,
  body: unknown,
): Promise<Result> {
  const ctx = await context(deps, auth, spaceId);
  if (isResult(ctx)) return ctx;
  const row = await findFile(deps, spaceId, fileId);
  if (!row) return fail(404, FILE_MSG.notFound);
  const f = row.value;
  const who = await names(deps);
  const view = (rec: FileRecord) => toView(rec, ctx.session.sub, ctx.m.isCreator, who, deps.now());
  if (f.status !== FILE_PROCESSING || isStale(f, deps.now())) return { status: 200, body: { file: view(f), done: true } };

  const step = Math.max(0, Math.floor(Number((body as { step?: unknown } | null)?.step ?? 0)) || 0);
  const finish = async (patch: Partial<FileRecord>) => {
    await deps.files.update(row.rowNumber, patch);
    return { status: 200, body: { file: view({ ...f, ...patch }), done: true } } satisfies Result;
  };
  const failWith = async (message: string) => {
    await deps.storage.remove(f.text_key).catch(() => undefined);
    return finish({ status: FILE_ERROR, error: message });
  };

  try {
    const size = await deps.storage.size(f.file_key);
    if (size === null) return failWith(FILE_MSG.notUploaded);
    if (size > FILE_LIMITS.maxBytes) {
      await deps.storage.remove(f.file_key).catch(() => undefined);
      return failWith(FILE_MSG.tooBig);
    }
    const bytes = await deps.storage.get(f.file_key);
    if (!bytes) return failWith(FILE_MSG.notUploaded);
    const type = fileType(f.name);
    if (!type) return failWith(FILE_MSG.badType);

    const outcome = await extractStep(type.kind, type.mime, bytes, step, deps.clients);

    // Scanned PDFs: pages OCR'd in earlier steps are kept at text_key until the end.
    let texts = outcome.texts;
    if (step > 0) {
      const prev = await deps.storage.get(f.text_key);
      const parsed = prev ? (JSON.parse(new TextDecoder().decode(prev)) as TextFile) : null;
      if (!parsed || !('partial' in parsed)) return failWith(FILE_MSG.failed);
      texts = [...parsed.texts, ...outcome.texts];
    }

    if (!outcome.done) {
      await deps.storage.put(f.text_key, encode({ v: 1, partial: true, texts }), 'application/json');
      const patch = { pages: String(outcome.pages) };
      await deps.files.update(row.rowNumber, patch);
      return {
        status: 200,
        body: {
          file: view({ ...f, ...patch }),
          done: false,
          next_step: outcome.nextStep,
          progress: { done_pages: texts.length, total_pages: outcome.pages },
        },
      };
    }

    const chunks = chunkPages(texts);
    if (chunks.length === 0) return failWith(FILE_MSG.noText);
    await deps.storage.put(f.text_key, encode({ v: 1, name: f.name, chunks }), 'application/json');
    return finish({ status: FILE_READY, error: '', pages: String(outcome.pages) });
  } catch (e) {
    deps.log(`file ${fileId} step ${step}: ${e instanceof Error ? e.message : 'error'}`);
    return failWith(e instanceof FileError ? e.message : FILE_MSG.failed);
  }
}

/** Soft delete (deleted = TRUE) and remove both objects from R2. Uploader or creator only. */
export async function deleteFile(deps: FileDeps, auth: string | null, spaceId: string, fileId: string): Promise<Result> {
  const ctx = await context(deps, auth, spaceId);
  if (isResult(ctx)) return ctx;
  const row = await findFile(deps, spaceId, fileId);
  if (!row) return fail(404, FILE_MSG.notFound);
  if (!ctx.m.isCreator && row.value.user_id !== ctx.session.sub) return fail(403, FILE_MSG.notAllowed);
  await deps.files.update(row.rowNumber, { deleted: TRUE });
  await Promise.all(
    [row.value.file_key, row.value.text_key].map((k) =>
      deps.storage.remove(k).catch((e) => deps.log(`r2 delete ${k}: ${e instanceof Error ? e.message : 'error'}`)),
    ),
  );
  return { status: 200, body: { ok: true } };
}
