import { z } from 'zod';
import { checkCredentials, startSession } from '@/lib/server/auth';
import { adminConfig } from '@/lib/server/config';
import { fail, handleError, json, readJson, sameOrigin } from '@/lib/server/http';
import { clientIp, rateLimit } from '@/lib/server/rateLimit';
import { audit } from '@/lib/server/repo';

export const runtime = 'nodejs';
const Body = z.object({ email: z.string().max(254), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return fail(403, 'Request blocked.');
    if (!adminConfig()) return fail(503, 'Admin sign-in is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH (see README).');
    const ip = clientIp(req);
    if (!rateLimit(`login:${ip}`, 8, 15 * 60 * 1000).ok) return fail(429, 'Too many sign-in attempts. Try again in a few minutes.');
    const body = Body.safeParse(await readJson<unknown>(req, 2000));
    if (!body.success) return fail(400, 'Enter your email and password.');
    if (!rateLimit(`login-acct:${body.data.email.toLowerCase()}`, 15, 60 * 60 * 1000).ok) return fail(429, 'Too many sign-in attempts. Try again later.');
    if (!checkCredentials(body.data.email, body.data.password)) {
      audit('unknown', 'admin.login_failed', null, ip);
      return fail(401, 'Incorrect email or password.');
    }
    await startSession(body.data.email);
    audit(body.data.email.toLowerCase(), 'admin.login');
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
