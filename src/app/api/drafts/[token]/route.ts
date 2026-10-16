import { clientIp, rateLimit } from '@/lib/server/rateLimit';
import { fail, handleError, json, readJson, sameOrigin } from '@/lib/server/http';
import { LIMITS } from '@/lib/server/config';
import { getDraft, listDraftFiles, saveDraft } from '@/lib/server/repo';
import type { FormData } from '@/lib/form/types';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    if (!rateLimit(`draftget:${clientIp(req)}`, 120, 10 * 60 * 1000).ok) return fail(429, 'Too many requests.');
    const draft = getDraft(token);
    if (!draft) return fail(404, 'This link is not valid or has expired.');
    return json({
      data: draft.data,
      step: draft.stepIndex,
      rev: draft.rev,
      files: listDraftFiles(draft.id),
      submitted: draft.submissionPublicId,
      contactName: draft.contactName,
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    if (!sameOrigin(req)) return fail(403, 'Request blocked.');
    const { token } = await params;
    if (!rateLimit(`draftput:${token.slice(0, 16)}`, 240, 10 * 60 * 1000).ok) return fail(429, 'Saving too quickly. Please wait a moment.');
    const draft = getDraft(token);
    if (!draft) return fail(404, 'This link is not valid or has expired.');
    if (draft.submissionPublicId) return fail(409, 'This form has already been submitted.');
    const body = await readJson<{ data?: FormData; step?: number }>(req, LIMITS.maxJsonBytes);
    if (!body || typeof body.data !== 'object' || body.data === null || Array.isArray(body.data))
      return fail(400, 'Invalid or oversized request.');
    const saved = saveDraft(draft, body.data, Number(body.step) || 0);
    return json({ ok: true, ...saved });
  } catch (e) {
    return handleError(e);
  }
}
