// Prints fresh random secrets for .env.local
import { randomBytes } from 'node:crypto';
console.log(`DATA_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString('base64')}`);
