import { currentAdmin } from '@/lib/server/auth';
import { fail, handleError } from '@/lib/server/http';
import { getFileForAdmin } from '@/lib/server/repo';
import { getFile } from '@/lib/server/storage';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

const INLINE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function GET(req: Request, { params }: Ctx) {
  try {
    if (!(await currentAdmin())) return fail(401, 'Sign in required.');
    const { id } = await params;
    if (!/^[a-f0-9]{32}$/.test(id)) return fail(404, 'Not found.');
    const meta = getFileForAdmin(id);
    if (!meta) return fail(404, 'Not found.');
    const data = await getFile(meta.storage_key);
    const inline = INLINE.has(meta.mime) && new URL(req.url).searchParams.get('download') !== '1';
    const filename = encodeURIComponent(meta.name);
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': meta.mime,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${filename}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
