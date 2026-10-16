import { computeFlags } from '@/lib/form/flags';
import { buildSummary } from '@/lib/form/summary';
import { currentAdmin } from '@/lib/server/auth';
import { fail, handleError } from '@/lib/server/http';
import { buildPdf } from '@/lib/server/pdf';
import { audit, getSubmission } from '@/lib/server/repo';
import { CHECKLIST } from '@/lib/server/workflow';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const admin = await currentAdmin();
    if (!admin) return fail(401, 'Sign in required.');
    const { id } = await params;
    const sub = getSubmission(id);
    if (!sub) return fail(404, 'Not found.');
    const format = new URL(req.url).searchParams.get('format') === 'pdf' ? 'pdf' : 'json';
    audit(admin, `export.${format}`, sub.id);
    const base = `arclo-gbp-${sub.publicId}`;
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

    if (format === 'pdf') {
      const pdf = await buildPdf(sub);
      return new Response(new Uint8Array(pdf), {
        headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${base}.pdf"` },
      });
    }
    const record = {
      schema: 'arclo.gbp-onboarding/1',
      submissionId: sub.publicId,
      status: sub.status,
      submittedAt: sub.submittedAt,
      business: sub.businessName,
      contact: { name: sub.contactName, email: sub.contactEmail },
      answers: sub.data,
      summary: buildSummary(sub.data, sub.files),
      flags: computeFlags(sub.data, sub.files),
      locations: sub.locations,
      files: sub.files,
      checklist: sub.checklist.map((c) => ({ ...c, label: CHECKLIST.find((x) => x.key === c.key)?.label })),
      notes: sub.notes,
    };
    return new Response(JSON.stringify(record, null, 2), {
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${base}.json"` },
    });
  } catch (e) {
    return handleError(e);
  }
}
