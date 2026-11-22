import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHOTO_PREFIX, photoKey, r2Storage, refFileKey } from './storage';

afterEach(() => vi.unstubAllGlobals());

describe('r2Storage', () => {
  it('builds the key and PUTs a SigV4-signed request to the bucket', async () => {
    const fetchMock = vi.fn(async (_req: Request) => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const storage = r2Storage({ accountId: 'acc', bucket: 'exengrupo-fotos', accessKeyId: 'AK', secretAccessKey: 'SK' });
    const key = photoKey('s1', 'p1');
    expect(key).toBe('spaces/s1/p1.jpg');
    await storage.put(key, new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg');
    const req = fetchMock.mock.calls[0][0];
    expect(req.method).toBe('PUT');
    expect(req.url).toBe('https://acc.r2.cloudflarestorage.com/exengrupo-fotos/spaces/s1/p1.jpg');
    expect(req.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 Credential=AK\/\d{8}\/auto\/s3\/aws4_request/);
    expect(new Uint8Array(await req.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
  });

  it('throws when R2 refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 403 })));
    const storage = r2Storage({ accountId: 'a', bucket: 'b', accessKeyId: 'k', secretAccessKey: 's' });
    await expect(storage.put('k.jpg', new Uint8Array([1]), 'image/jpeg')).rejects.toThrow(/403/);
  });

  it('ignores spaces and line breaks pasted around the keys (real production bug)', async () => {
    const fetchMock = vi.fn(async (_req: Request) => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const storage = r2Storage({ accountId: ' acc\n', bucket: 'exengrupo-fotos\n', accessKeyId: 'AK\n\n', secretAccessKey: ' SK\r\n' });
    await storage.put('spaces/s1/p1.jpg', new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg');
    const req = fetchMock.mock.calls[0][0];
    expect(req.url).toBe('https://acc.r2.cloudflarestorage.com/exengrupo-fotos/spaces/s1/p1.jpg');
    expect(req.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 Credential=AK\/\d{8}\/auto\/s3\/aws4_request, /);
  });

  it('keeps photos and reference files under different prefixes', () => {
    expect(photoKey('s1', 'p1')).toBe('spaces/s1/p1.jpg');
    expect(refFileKey('s1', 'f1', 'pdf').startsWith(PHOTO_PREFIX)).toBe(false);
  });
});
