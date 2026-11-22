/**
 * Every /api/spaces/* route (see server/router.ts):
 *   GET    /api/spaces                         my spaces
 *   POST   /api/spaces                         create { name }
 *   POST   /api/spaces/join                    join { code }
 *   GET    /api/spaces/:id                     details + members
 *   PATCH  /api/spaces/:id                     rename { name }        (creator)
 *   DELETE /api/spaces/:id                     soft delete            (creator)
 *   DELETE /api/spaces/:id/members/:userId     soft remove member     (creator)
 *   GET    /api/spaces/:id/posts               feed, newest first
 *   POST   /api/spaces/:id/posts               multipart "photo" (JPEG ≤ 3 MB) → answer
 *   GET    /api/spaces/:id/posts/:postId       one post (after a broadcast)
 *   GET    /api/spaces/:id/files               reference files (name, type, pages, status)
 *   POST   /api/spaces/:id/files               { name, size } → row + presigned R2 PUT URL
 *   POST   /api/spaces/:id/files/:fileId/process  { step } → one processing step
 *   DELETE /api/spaces/:id/files/:fileId       soft delete + remove from R2 (uploader/creator)
 */
import type { Result } from '../server/auth';
import { createPost, getPost, listPosts } from '../server/posts';
import { matchSpacesRoute, spacesPath } from '../server/router';
import { createFile, deleteFile, listFiles, processFile } from '../server/files/handlers';
import { dataDeps, fileDeps, postDeps, readJson, respond } from '../server/http';
import {
  createSpace,
  deleteSpace,
  getSpace,
  joinSpace,
  listMySpaces,
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
    case 'methodNotAllowed':
      return { status: 405, body: { error: 'Método no permitido.' } };
    default:
      return { status: 404, body: { error: 'No encontrado.' } };
  }
}

const handler = (request: Request): Promise<Response> => respond(() => dispatch(request));

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
