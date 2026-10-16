// Usage: npm run admin:hash -- 'your-password'
// Prints a scrypt hash to paste into ADMIN_PASSWORD_HASH.
import { randomBytes, scryptSync } from 'node:crypto';

const pw = process.argv[2];
if (!pw || pw.length < 12) {
  console.error('Provide a password of at least 12 characters: npm run admin:hash -- "<password>"');
  process.exit(1);
}
const salt = randomBytes(16);
const N = 16384, r = 8, p = 1;
const hash = scryptSync(pw, salt, 64, { N, r, p });
console.log(`scrypt:${N}:${r}:${p}:${salt.toString('base64')}:${hash.toString('base64')}`);
