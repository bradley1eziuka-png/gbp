import { currentAdmin } from '@/lib/server/auth';
import { fail, handleError, json, readJson, sameOrigin } from '@/lib/server/http';
import { setChecklist } from '@/lib/server/repo';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    if (!sameOrigin(req)) return fail(403, 'Request blocked.');
    const admin = await currentAdmin();
    if (!admin) return fail(401, 'Sign in required.');
    const { id } = await params;
    const body = await readJson<{ key?: string; done?: boolean }>(req, 1000);
    if (!body?.key || typeof body.done !== 'boolean' || !setChecklist(id, body.key, body.done, admin)) return fail(400, 'Invalid request.');
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
