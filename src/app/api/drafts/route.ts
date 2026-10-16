import { z } from 'zod';
import { LIMITS } from '@/lib/server/config';
import { createDraft } from '@/lib/server/repo';
import { clientIp, rateLimit } from '@/lib/server/rateLimit';
import { fail, handleError, json, readJson, sameOrigin } from '@/lib/server/http';
import { resumeEmail, sendEmail } from '@/lib/server/email';
import { audit } from '@/lib/server/repo';

export const runtime = 'nodejs';

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().max(254).pipe(z.email()),
  hp: z.string().max(200).optional(),
  ts: z.number().optional(),
  cf: z.string().max(4096).optional(),
});

async function turnstileOk(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // optional layer; honeypot, timing and rate limits still apply
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, ...(ip !== 'shared' ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return fail(403, 'Request blocked.');
    const ip = clientIp(req);
    const rl = rateLimit(`draft:${ip}`, 8, 60 * 60 * 1000);
    if (!rl.ok) return fail(429, 'Too many attempts. Please try again later.', { retryAfter: rl.retryAfter });

    const raw = await readJson<unknown>(req, 10_000);
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return fail(400, 'Please enter your name and a valid email address.');
    const { name, email, hp, ts, cf } = parsed.data;

    // Bots fill hidden fields and submit instantly. Respond as if it worked, store nothing.
    if ((hp && hp.length > 0) || (typeof ts === 'number' && Date.now() - ts < 1500)) {
      audit('system', 'spam.blocked', null, 'honeypot/timing');
      return json({ token: 'x'.repeat(43), emailStatus: 'sent' });
    }
    if (!(await turnstileOk(cf, ip))) return fail(400, 'Please complete the verification challenge and try again.');

    const { token } = createDraft(name, email);
    const mail = resumeEmail(name, token);
    const sent = await sendEmail(email, mail.subject, mail.text);
    return json({ token, emailStatus: sent.status, ttlDays: LIMITS.draftTtlDays });
  } catch (e) {
    return handleError(e);
  }
}
