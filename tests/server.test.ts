import { randomBytes, scryptSync } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
});

describe('encryption', () => {
  it('round-trips JSON and rejects tampering', async () => {
    const { decryptJSON, encryptJSON } = await import('@/lib/server/crypto');
    const blob = encryptJSON({ secret: 'home address' });
    expect(blob.toString('utf8')).not.toContain('home address');
    expect(decryptJSON<{ secret: string }>(blob).secret).toBe('home address');
    blob[blob.length - 1] ^= 1;
    expect(() => decryptJSON(blob)).toThrow();
  });
  it('generates unguessable, non-sequential public IDs', async () => {
    const { publicId } = await import('@/lib/server/crypto');
    const ids = new Set(Array.from({ length: 500 }, publicId));
    expect(ids.size).toBe(500);
    expect([...ids][0]).toMatch(/^ARC-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
  it('verifies scrypt password hashes', async () => {
    const { verifyPassword } = await import('@/lib/server/crypto');
    const salt = randomBytes(16);
    const hash = scryptSync('correct horse battery', salt, 64, { N: 16384, r: 8, p: 1 });
    const stored = `scrypt:16384:8:1:${salt.toString('base64')}:${hash.toString('base64')}`;
    expect(verifyPassword('correct horse battery', stored)).toBe(true);
    expect(verifyPassword('wrong', stored)).toBe(false);
    expect(verifyPassword('x', 'garbage')).toBe(false);
  });
});

describe('file sniffing', () => {
  it('identifies by bytes, ignoring names', async () => {
    const { sniff, allowed } = await import('@/lib/server/fileTypes');
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
    expect(sniff(jpg)?.mime).toBe('image/jpeg');
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
    expect(sniff(png)?.mime).toBe('image/png');
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(20)]);
    expect(sniff(mp4)?.kind).toBe('video');
    expect(allowed('image', sniff(mp4)!)).toBe(false);
    expect(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniff(Buffer.from('<?php echo 1; ?> padding padding'))).toBeNull();
  });
});

describe('rate limiting', () => {
  it('blocks after the limit', async () => {
    const { rateLimit } = await import('@/lib/server/rateLimit');
    const results = Array.from({ length: 5 }, () => rateLimit('t', 3, 60_000).ok);
    expect(results).toEqual([true, true, true, false, false]);
  });
});
