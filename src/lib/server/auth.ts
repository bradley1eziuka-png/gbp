import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminConfig, isProd, sessionSecret } from './config';
import { hmac, safeEqual, verifyPassword } from './crypto';

const COOKIE = 'arclo_admin';
const TTL_SECONDS = 60 * 60 * 10;

export function checkCredentials(email: string, password: string): boolean {
  const cfg = adminConfig();
  if (!cfg) return false;
  // Always run the hash to keep timing similar whether or not the email matches.
  const passOk = verifyPassword(password, cfg.hash);
  return safeEqual(email.trim().toLowerCase(), cfg.email) && passOk;
}

function sign(email: string, exp: number): string {
  const payload = Buffer.from(JSON.stringify({ e: email, x: exp })).toString('base64url');
  return `${payload}.${hmac(sessionSecret(), payload)}`;
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, hmac(sessionSecret(), payload))) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { e: string; x: number };
    const cfg = adminConfig();
    if (!cfg || x < Date.now() / 1000 || e !== cfg.email) return null;
    return e;
  } catch {
    return null;
  }
}

export async function startSession(email: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  (await cookies()).set(COOKIE, sign(email.trim().toLowerCase(), exp), {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** Returns the admin email if signed in, otherwise null. */
export async function currentAdmin(): Promise<string | null> {
  return verify((await cookies()).get(COOKIE)?.value);
}

/** For server components: redirect to login when unauthenticated. */
export async function requireAdminPage(): Promise<string> {
  const a = await currentAdmin();
  if (!a) redirect('/admin/login');
  return a;
}
