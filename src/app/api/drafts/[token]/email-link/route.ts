import { resumeEmail, sendEmail } from '@/lib/server/email';
import { fail, handleError, json, sameOrigin } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rateLimit';
import { getDraft } from '@/lib/server/repo';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ token: string }> };

/** Re-sends the resume link to the email the draft was started with (never to an arbitrary address). */
export async function POST(req: Request, { params }: Ctx) {
  try {
    if (!sameOrigin(req)) return fail(403, 'Request blocked.');
    const { token } = await params;
    if (!rateLimit(`resume:${token.slice(0, 16)}`, 3, 60 * 60 * 1000).ok) return fail(429, 'Please wait before requesting another email.');
    const draft = getDraft(token);
    if (!draft || draft.submissionPublicId) return fail(404, 'This link is not valid or has expired.');
    const mail = resumeEmail(draft.contactName, token);
    const r = await sendEmail(draft.contactEmail, mail.subject, mail.text);
    return json({ status: r.status });
  } catch (e) {
    return handleError(e);
  }
}
