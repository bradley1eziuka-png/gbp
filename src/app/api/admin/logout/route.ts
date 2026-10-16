import { endSession } from '@/lib/server/auth';
import { fail, json, sameOrigin } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, 'Request blocked.');
  await endSession();
  return json({ ok: true });
}
