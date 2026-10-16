import { after } from 'next/server';
import { computeFlags } from '@/lib/form/flags';
import { confirmationEmail, notifyEmail, sendEmail } from '@/lib/server/email';
import { fail, handleError, json, sameOrigin } from '@/lib/server/http';
import { clientIp, rateLimit } from '@/lib/server/rateLimit';
import { getDraft, getSubmission, setEmailStatus, submitDraft } from '@/lib/server/repo';
import { emailConfig } from '@/lib/server/config';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ token: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    if (!sameOrigin(req)) return fail(403, 'Request blocked.');
    const { token } = await params;
    if (!rateLimit(`submit:${clientIp(req)}`, 10, 60 * 60 * 1000).ok) return fail(429, 'Too many attempts. Please try again later.');
    const draft = getDraft(token);
    if (!draft) return fail(404, 'This link is not valid or has expired.');

    const result = submitDraft(draft);
    if (!result.ok) {
      if (result.reason === 'already_submitted') return fail(409, 'This form has already been submitted.', { submissionId: draft.submissionPublicId });
      return fail(422, 'Some answers need attention before you can submit.', { errors: result.errors });
    }

    const sub = getSubmission(result.submissionId)!;
    after(async () => {
      try {
        const c = confirmationEmail(sub.contactName, sub.businessName, sub.publicId);
        const r1 = await sendEmail(sub.contactEmail, c.subject, c.text);
        setEmailStatus(sub.id, 'client', r1.status, r1.error);
        const flags = computeFlags(sub.data, sub.files);
        const n = notifyEmail(sub.businessName, sub.publicId, sub.id, flags.filter((f) => f.severity === 'blocker').length, flags.filter((f) => f.severity === 'attention').length);
        const to = emailConfig()?.notifyTo ?? '';
        const r2 = to ? await sendEmail(to, n.subject, n.text) : { status: 'not_configured' as const, error: 'ARCLO_NOTIFY_EMAIL not set' };
        setEmailStatus(sub.id, 'notify', r2.status, r2.error);
      } catch (e) {
        console.error('[post-submit email]', e);
      }
    });

    return json({ ok: true, submissionId: result.publicId, emailsConfigured: !!emailConfig() });
  } catch (e) {
    return handleError(e);
  }
}
