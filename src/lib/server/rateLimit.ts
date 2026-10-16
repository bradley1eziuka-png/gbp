import { trustProxy } from './config';

/**
 * In-memory sliding-window limiter. Fine for a single server process.
 * On serverless / multiple instances replace the store with Redis (Upstash), see README.
 */
const store = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    store.set(key, hits);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  store.set(key, hits);
  if (store.size > 5000) for (const [k, v] of store) if (!v.some((t) => now - t < windowMs)) store.delete(k);
  return { ok: true, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  if (trustProxy()) {
    const xf = req.headers.get('x-forwarded-for');
    if (xf) return xf.split(',')[0].trim();
    const real = req.headers.get('x-real-ip');
    if (real) return real.trim();
  }
  return 'shared';
}
