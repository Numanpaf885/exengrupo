/**
 * Every /api/spaces/* route (see server/router.ts):
 *   GET    /api/spaces                         my spaces + can_create
 *   POST   /api/spaces                         create { name, member_ids? }  (allowed users only)
 *   POST   /api/spaces/join                    join { code }
 *   GET    /api/spaces/people                  people who can be added (creators only)
 *   GET    /api/spaces/:id                     details + members
 *   PATCH  /api/spaces/:id                     rename { name }        (creator)
 *   DELETE /api/spaces/:id                     soft delete            (creator)
 *   POST   /api/spaces/:id/archive             { archived } hide/show for members (creator)
 *   GET    /api/spaces/:id/photos              photos of the last 7 days + signed links
 *   GET    /api/spaces/:id/photos/:postId?t=   the JPEG (signed link, no session header)
 *   POST   /api/spaces/:id/members             add { user_ids }       (creator)
 *   DELETE /api/spaces/:id/members/:userId     soft remove member     (creator)
 *   GET    /api/spaces/:id/posts               feed, newest first
 *   POST   /api/spaces/:id/posts               multipart "photo" (JPEG ≤ 3 MB) → answer
 *   GET    /api/spaces/:id/posts/:postId       one post (after a broadcast)
 *   GET    /api/spaces/:id/files               reference files (name, type, pages, status)
 *   POST   /api/spaces/:id/files               { name, size } → row + upload token
 *   PUT    /api/spaces/:id/files/:fileId/chunks/:n  raw bytes ≤ 4 MB (header x-upload-token)
 *   POST   /api/spaces/:id/files/:fileId/process  { step, chunks } → one processing step
 *   DELETE /api/spaces/:id/files/:fileId       soft delete + remove from R2 (uploader/creator)
 */
import type { Result } from '../server/auth';
import { getPhoto, listPhotos } from '../server/photos';
import { createPost, getPost, listPosts } from '../server/posts';
import { matchSpacesRoute, spacesPath } from '../server/router';
import { createFile, deleteFile, listFiles, processFile, uploadChunk } from '../server/files/handlers';
import { dataDeps, fileDeps, photoDeps, postDeps, readJson, respond } from '../server/http';
import {
  addMembers,
  archiveSpace,
  createSpace,
  deleteSpace,
  getSpace,
  joinSpace,
  listMySpaces,
  listPeople,
  removeMember,
  renameSpace,
} from '../server/spaces';

async function readPhoto(request: Request): Promise<Uint8Array | null> {
  try {
    // React Native's FormData typing shadows the web one here; this is the web (undici) FormData.
    const form = (await request.formData()) as unknown as { get(name: string): Blob | string | null };
    const file = form.get('photo');
    if (!file || typeof file === 'string') return null;
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
}

async function dispatch(request: Request): Promise<Result> {
  const route = matchSpacesRoute(request.method, spacesPath(new URL(request.url)));
  const auth = request.headers.get('authorization');
  switch (route.name) {
    case 'list':
      return listMySpaces(dataDeps(), auth);
    case 'create':
      return createSpace(dataDeps(), auth, await readJson(request));
    case 'join':
      return joinSpace(dataDeps(), auth, await readJson(request));
    case 'people':
      return listPeople(dataDeps(), auth);
    case 'addMembers':
      return addMembers(dataDeps(), auth, route.spaceId, await readJson(request));
    case 'archive':
      return archiveSpace(dataDeps(), auth, route.spaceId, await readJson(request));
    case 'listPhotos':
      return listPhotos(dataDeps(), auth, route.spaceId);
    case 'get':
      return getSpace(dataDeps(), auth, route.spaceId);
    case 'rename':
      return renameSpace(dataDeps(), auth, route.spaceId, await readJson(request));
    case 'delete':
      return deleteSpace(dataDeps(), auth, route.spaceId);
    case 'removeMember':
      return removeMember(dataDeps(), auth, route.spaceId, route.userId);
    case 'listPosts':
      return listPosts(dataDeps(), auth, route.spaceId);
    case 'createPost':
      return createPost(postDeps(), auth, route.spaceId, await readPhoto(request));
    case 'getPost':
      return getPost(dataDeps(), auth, route.spaceId, route.postId);
    case 'listFiles':
      return listFiles(fileDeps(), auth, route.spaceId);
    case 'createFile':
      return createFile(fileDeps(), auth, route.spaceId, await readJson(request));
    case 'processFile':
      return processFile(fileDeps(), auth, route.spaceId, route.fileId, await readJson(request));
    case 'deleteFile':
      return deleteFile(fileDeps(), auth, route.spaceId, route.fileId);
    case 'uploadChunk': {
      let bytes: Uint8Array | null = null;
      try {
        bytes = new Uint8Array(await request.arrayBuffer());
      } catch {
        bytes = null;
      }
      return uploadChunk(fileDeps(), request.headers.get('x-upload-token'), route.spaceId, route.fileId, route.index, bytes);
    }
    case 'methodNotAllowed':
      return { status: 405, body: { error: 'Método no permitido.' } };
    default:
      return { status: 404, body: { error: 'No encontrado.' } };
  }
}

/** Photos are bytes, not JSON: answered here, outside respond(). */
async function photo(request: Request, spaceId: string, postId: string): Promise<Response> {
  try {
    const res = await getPhoto(photoDeps(), new URL(request.url).searchParams.get('t'), spaceId, postId);
    if (res.status !== 200) return new Response(null, { status: res.status, headers: { 'cache-control': 'no-store' } });
    return new Response(res.bytes as unknown as BodyInit, {
      status: 200,
      // The link is the same for a 6-hour window: let the phone keep the image that long.
      headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=21600' },
    });
  } catch (e) {
    console.error('photo failed', e instanceof Error ? e.message : e);
    return new Response(null, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
}

const handler = (request: Request): Promise<Response> => {
  const route = matchSpacesRoute(request.method, spacesPath(new URL(request.url)));
  if (route.name === 'getPhoto') return photo(request, route.spaceId, route.postId);
  return respond(() => dispatch(request));
};

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
export const PUT = handler;
