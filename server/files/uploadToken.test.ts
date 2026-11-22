import { describe, expect, it } from 'vitest';
import { signUploadToken, UPLOAD_TOKEN_TTL_MS, verifyUploadToken } from './uploadToken';

describe('upload tokens', () => {
  const grant = { fileId: 'f1', spaceId: 's1', userId: 'u1' };
  it('round-trips and expires after an hour', () => {
    const t = signUploadToken(grant, 'secret', 1000);
    expect(verifyUploadToken(t, 'secret', 1000 + UPLOAD_TOKEN_TTL_MS)).toEqual(grant);
    expect(verifyUploadToken(t, 'secret', 1001 + UPLOAD_TOKEN_TTL_MS)).toBeNull();
  });
  it('rejects another secret, a changed payload and garbage', () => {
    const t = signUploadToken(grant, 'secret', 1000);
    expect(verifyUploadToken(t, 'other', 1000)).toBeNull();
    const [v, , sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ f: 'f2', s: 's1', u: 'u1', exp: 9e15 })).toString('base64url');
    expect(verifyUploadToken(`${v}.${forged}.${sig}`, 'secret', 1000)).toBeNull();
    expect(verifyUploadToken('', 'secret', 1000)).toBeNull();
    expect(verifyUploadToken('v1.a.b', 'secret', 1000)).toBeNull();
  });
});
