import path from 'node:path';

export const isProd = process.env.NODE_ENV === 'production';
/** Resolved lazily at runtime; the default is ./.data next to where the server is started. */
export const dataDir = () => path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || '.data');

export class ConfigError extends Error {}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new ConfigError(`Missing required environment variable ${name}. See README.md → Configuration.`);
  return v;
}

/** 32-byte AES key used for data and file encryption at rest. */
export function encryptionKey(): Buffer {
  const key = Buffer.from(required('DATA_ENCRYPTION_KEY'), 'base64');
  if (key.length !== 32) throw new ConfigError('DATA_ENCRYPTION_KEY must be 32 random bytes, base64 encoded (npm run keys:generate).');
  return key;
}

export function sessionSecret(): Buffer {
  const s = Buffer.from(required('SESSION_SECRET'), 'base64');
  if (s.length < 32) throw new ConfigError('SESSION_SECRET must be at least 32 random bytes, base64 encoded (npm run keys:generate).');
  return s;
}

export const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

export const adminConfig = () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  return email && hash ? { email, hash } : null;
};

export const emailConfig = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return apiKey && from ? { apiKey, from, notifyTo: process.env.ARCLO_NOTIFY_EMAIL || '' } : null;
};

export const trustProxy = () => process.env.TRUST_PROXY === 'true';

export const LIMITS = {
  draftTtlDays: 60,
  maxJsonBytes: 600_000,
  imageBytes: 15 * 1024 * 1024,
  videoBytes: 75 * 1024 * 1024,
  filesPerDraft: 80,
  bytesPerDraft: 500 * 1024 * 1024,
};
