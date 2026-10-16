export type Accept = 'image' | 'video' | 'media';

export interface Sniffed {
  mime: string;
  ext: string;
  kind: 'image' | 'video';
}

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];

/**
 * Identify the file from its bytes. The client-declared MIME type and file extension are never trusted.
 * SVG and GIF are deliberately unsupported (script injection / not useful for profiles).
 */
export function sniff(buf: Buffer): Sniffed | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg', kind: 'image' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: 'image/png', ext: 'png', kind: 'image' };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return { mime: 'image/webp', ext: 'webp', kind: 'image' };
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12).toLowerCase();
    if (HEIC_BRANDS.includes(brand)) return { mime: 'image/heic', ext: 'heic', kind: 'image' };
    if (brand === 'qt  ') return { mime: 'video/quicktime', ext: 'mov', kind: 'video' };
    return { mime: 'video/mp4', ext: 'mp4', kind: 'video' };
  }
  return null;
}

export function allowed(accept: Accept, s: Sniffed): boolean {
  return accept === 'media' || accept === s.kind;
}

export function cleanName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim().slice(0, 120) || 'file';
}
