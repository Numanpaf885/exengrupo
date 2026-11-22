/** Private Cloudflare R2 bucket via the S3 API (SigV4 signing with aws4fetch). */
import { AwsClient } from 'aws4fetch';

export interface PhotoStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
}

export const photoKey = (spaceId: string, postId: string): string => `spaces/${spaceId}/${postId}.jpg`;

export function r2Storage(opts: {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}): PhotoStorage {
  // Trim: a value pasted with a trailing line break would end up inside the Authorization header.
  const client = new AwsClient({
    accessKeyId: opts.accessKeyId.trim(),
    secretAccessKey: opts.secretAccessKey.trim(),
    service: 's3',
    region: 'auto',
  });
  const base = `https://${opts.accountId.trim()}.r2.cloudflarestorage.com/${encodeURIComponent(opts.bucket.trim())}`;
  return {
    async put(key, bytes, contentType) {
      const path = key.split('/').map(encodeURIComponent).join('/');
      const res = await client.fetch(`${base}/${path}`, {
        method: 'PUT',
        // A plain ArrayBuffer so aws4fetch can hash the payload for SigV4.
        body: bytes.slice().buffer,
        headers: { 'content-type': contentType },
      });
      if (!res.ok) throw new Error(`R2 upload failed (${res.status})`);
    },
  };
}
