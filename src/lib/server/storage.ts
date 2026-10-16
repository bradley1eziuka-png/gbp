import fs from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from './config';
import { decryptBuffer, encryptBuffer, randomToken } from './crypto';

/**
 * Private, encrypted file storage on local disk (outside any web-served directory).
 * Files are AES-256-GCM encrypted at rest; they can only be read back through authenticated routes.
 * To use S3/R2 instead, replace these three functions (see README → Production storage).
 */
const dir = () => path.join(dataDir(), 'uploads');

export async function putFile(plain: Buffer): Promise<string> {
  await fs.mkdir(dir(), { recursive: true, mode: 0o700 });
  const key = randomToken(24);
  await fs.writeFile(path.join(dir(), key), encryptBuffer(plain), { mode: 0o600 });
  return key;
}

export async function getFile(key: string): Promise<Buffer> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(key)) throw new Error('Invalid storage key');
  return decryptBuffer(await fs.readFile(path.join(dir(), key)));
}

export async function deleteFile(key: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(key)) return;
  await fs.rm(path.join(dir(), key), { force: true });
}
