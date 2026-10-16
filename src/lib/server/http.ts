import { NextResponse } from 'next/server';
import { ConfigError } from './config';

export const json = (body: unknown, status = 200, headers?: Record<string, string>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export const fail = (status: number, error: string, extra?: Record<string, unknown>) => json({ error, ...extra }, status);

/** CSRF defence in depth for cookie-authenticated and public POSTs: Origin must match Host. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

export function handleError(e: unknown) {
  if (e instanceof ConfigError) {
    console.error('[config]', e.message);
    return fail(503, 'The server is not fully configured. Please contact Arclo.');
  }
  console.error('[server error]', e);
  return fail(500, 'Something went wrong. Please try again.');
}

export async function readJson<T>(req: Request, maxBytes: number): Promise<T | null> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
