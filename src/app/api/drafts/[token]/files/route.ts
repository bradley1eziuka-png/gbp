import { STEPS } from '@/lib/form/steps';
import { LIMITS } from '@/lib/server/config';
import { fail, handleError, json, sameOrigin } from '@/lib/server/http';
import { clientIp, rateLimit } from '@/lib/server/rateLimit';
import { allowed, cleanName, sniff, type Accept } from '@/lib/server/fileTypes';
import { draftCategoryCount, draftUsage, getDraft, insertDraftFile, removeDraftFile } from '@/lib/server/repo';
import { putFile } from '@/lib/server/storage';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ token: string }> };

const FILE_FIELDS = Object.fromEntries(
  STEPS.flatMap((s) => s.fields)
    .filter((f) => f.type === 'files' && f.category)
    .map((f) => [f.category!, { accept: (f.accept ?? 'image') as Accept, max: f.maxFiles ?? 10 }]),
);

export async function POST(req: Request, { params }: Ctx) {
  try {
    if (!sameOrigin(req)) return fail(403, 'Request blocked.');
    const { token } = await params;
    if (!rateLimit(`upload:${clientIp(req)}`, 120, 60 * 60 * 1000).ok) return fail(429, 'Too many uploads. Please try again later.');
    const draft = getDraft(token);
    if (!draft) return fail(404, 'This link is not valid or has expired.');
    if (draft.submissionPublicId) return fail(409, 'This form has already been submitted.');

    const declared = Number(req.headers.get('content-length') ?? 0);
    if (declared > LIMITS.videoBytes + 1_000_000) return fail(413, 'That file is too large.');

    const form = await req.formData();
    const category = String(form.get('category') ?? '');
    const file = form.get('file');
    const rule = FILE_FIELDS[category];
    if (!rule) return fail(400, 'Unknown upload category.');
    if (!(file instanceof File)) return fail(400, 'No file received.');

    const buf = Buffer.from(await file.arrayBuffer());
    const kind = sniff(buf);
    if (!kind || !allowed(rule.accept, kind))
      return fail(415, rule.accept === 'video' ? 'Please upload an MP4 or MOV video.' : 'Please upload a JPG, PNG, WebP, or HEIC image.');
    const limit = kind.kind === 'video' ? LIMITS.videoBytes : LIMITS.imageBytes;
    if (buf.length > limit) return fail(413, `That file is too large (limit ${Math.round(limit / 1024 / 1024)} MB).`);

    const usage = draftUsage(draft.id);
    if (usage.count >= LIMITS.filesPerDraft || usage.bytes + buf.length > LIMITS.bytesPerDraft)
      return fail(413, 'You have reached the total upload limit. Please contact Arclo to send more.');
    if (draftCategoryCount(draft.id, category) >= rule.max) return fail(400, `You can upload up to ${rule.max} files here.`);

    const storageKey = await putFile(buf);
    const meta = insertDraftFile(draft.id, { category, name: cleanName(file.name), mime: kind.mime, size: buf.length, storageKey });
    return json({ file: meta });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    if (!sameOrigin(req)) return fail(403, 'Request blocked.');
    const { token } = await params;
    const draft = getDraft(token);
    if (!draft) return fail(404, 'This link is not valid or has expired.');
    if (draft.submissionPublicId) return fail(409, 'This form has already been submitted.');
    const id = new URL(req.url).searchParams.get('id') ?? '';
    return (await removeDraftFile(draft.id, id)) ? json({ ok: true }) : fail(404, 'File not found.');
  } catch (e) {
    return handleError(e);
  }
}
