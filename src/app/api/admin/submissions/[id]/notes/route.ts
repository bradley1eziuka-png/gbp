import { currentAdmin } from '@/lib/server/auth';
import { fail, handleError, json, readJson, sameOrigin } from '@/lib/server/http';
import { addNote } from '@/lib/server/repo';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    if (!sameOrigin(req)) return fail(403, 'Request blocked.');
    const admin = await currentAdmin();
    if (!admin) return fail(401, 'Sign in required.');
    const { id } = await params;
    const body = await readJson<{ body?: string }>(req, 10_000);
    const text = body?.body?.trim();
    if (!text || text.length > 5000 || !addNote(id, text, admin)) return fail(400, 'Enter a note (up to 5,000 characters).');
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
