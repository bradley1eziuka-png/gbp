import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { encryptionKey } from './config';

const VERSION = 1;

/** AES-256-GCM. Layout: [version(1)][iv(12)][tag(16)][ciphertext] */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ct]);
}

export function decryptBuffer(blob: Buffer): Buffer {
  if (blob[0] !== VERSION) throw new Error('Unsupported ciphertext version');
  const iv = blob.subarray(1, 13);
  const tag = blob.subarray(13, 29);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(29)), decipher.final()]);
}

export const encryptJSON = (v: unknown): Buffer => encryptBuffer(Buffer.from(JSON.stringify(v), 'utf8'));
export const decryptJSON = <T = unknown>(blob: Buffer): T => JSON.parse(decryptBuffer(blob).toString('utf8')) as T;

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const uuid = () => randomBytes(16).toString('hex');

/** Unguessable, human-friendly submission ID, e.g. ARC-7K3Q-M9XD (≈ 40 bits random; never sequential). */
export function publicId(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  const b = randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[b[i] % alphabet.length];
  return `ARC-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function hmac(secret: Buffer, data: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/** Verifies "scrypt:N:r:p:saltB64:hashB64" (see scripts/hash-password.mjs). ":" avoids dotenv "$" expansion. */
export function verifyPassword(password: string, stored: string): boolean {
  const [alg, N, r, p, salt, hash] = stored.split(':');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
