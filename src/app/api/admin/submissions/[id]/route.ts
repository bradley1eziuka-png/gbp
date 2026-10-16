import { currentAdmin } from '@/lib/server/auth';
import { fail, handleError, json, readJson, sameOrigin } from '@/lib/server/http';
import { setStatus } from '@/lib/server/repo';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    if (!sameOrigin(req)) return fail(403, 'Request blocked.');
    const admin = await currentAdmin();
    if (!admin) return fail(401, 'Sign in required.');
    const { id } = await params;
    const body = await readJson<{ status?: string }>(req, 1000);
    if (!body?.status || !setStatus(id, body.status, admin)) return fail(400, 'Invalid status or submission.');
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
