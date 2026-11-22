/** Private Cloudflare R2 bucket via the S3 API (SigV4 signing with aws4fetch). */
import { AwsClient } from 'aws4fetch';

export interface PhotoStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
}

/** Everything the reference-file feature needs from R2. */
export interface ObjectStorage extends PhotoStorage {
  /** The object's bytes, or null when it doesn't exist. */
  get(key: string): Promise<Uint8Array | null>;
  /** The object's size in bytes, or null when it doesn't exist. */
  size(key: string): Promise<number | null>;
  remove(key: string): Promise<void>;
  /** A URL the phone can PUT the file to directly (bypasses Vercel's body limit). */
  presignPut(key: string, contentType: string, expiresSec: number): Promise<string>;
}

/** Photos live under spaces/ — the ONLY prefix the 7-day lifecycle rule may delete. */
export const PHOTO_PREFIX = 'spaces/';
export const photoKey = (spaceId: string, postId: string): string => `${PHOTO_PREFIX}${spaceId}/${postId}.jpg`;

/** Reference files live under refs/ and are kept until a member deletes them. */
export const REF_PREFIX = 'refs/';
export const refFileKey = (spaceId: string, fileId: string, ext: string) => `${REF_PREFIX}${spaceId}/${fileId}.${ext}`;
export const refTextKey = (spaceId: string, fileId: string) => `${REF_PREFIX}${spaceId}/${fileId}.chunks.json`;

export function r2Storage(opts: {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}): ObjectStorage {
  // Trim: a value pasted with a trailing line break would end up inside the Authorization header.
  const client = new AwsClient({
    accessKeyId: opts.accessKeyId.trim(),
    secretAccessKey: opts.secretAccessKey.trim(),
    service: 's3',
    region: 'auto',
  });
  const base = `https://${opts.accountId.trim()}.r2.cloudflarestorage.com/${encodeURIComponent(opts.bucket.trim())}`;
  const url = (key: string) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  return {
    async put(key, bytes, contentType) {
      const res = await client.fetch(url(key), {
        method: 'PUT',
        // A plain ArrayBuffer so aws4fetch can hash the payload for SigV4.
        body: bytes.slice().buffer,
        headers: { 'content-type': contentType },
      });
      if (!res.ok) throw new Error(`R2 upload failed (${res.status})`);
    },
    async get(key) {
      const res = await client.fetch(url(key), { method: 'GET' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 read failed (${res.status})`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async size(key) {
      const res = await client.fetch(url(key), { method: 'HEAD' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 head failed (${res.status})`);
      return Number(res.headers.get('content-length') ?? '0');
    },
    async remove(key) {
      const res = await client.fetch(url(key), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed (${res.status})`);
    },
    async presignPut(key, _contentType, expiresSec) {
      const target = new URL(url(key));
      target.searchParams.set('X-Amz-Expires', String(expiresSec));
      // Query signing: only the host header is signed, so the phone may send any content-type.
      const signed = await client.sign(target.toString(), { method: 'PUT', aws: { signQuery: true } });
      return signed.url;
    },
  };
}

/** In-memory storage for tests. */
export function memoryStorage(): ObjectStorage & { objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    async put(key, bytes) {
      objects.set(key, bytes);
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
    async size(key) {
      return objects.get(key)?.length ?? null;
    },
    async remove(key) {
      objects.delete(key);
    },
    async presignPut(key) {
      return `https://r2.test/${key}?X-Amz-Signature=test`;
    },
  };
}
