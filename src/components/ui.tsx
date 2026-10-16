import Link from 'next/link';
import type { ReactNode } from 'react';

export function ArcMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 19C3 10.7 7.7 5 12 5s9 5.7 9 14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Header({ right }: { right?: ReactNode }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand" aria-label="Arclo home">
          <ArcMark /> Arclo
        </Link>
        {right}
      </div>
    </header>
  );
}

const ICONS = {
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 100 18 9 9 0 000-18z',
  warn: 'M12 9v4m0 4h.01M10.3 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  policy: 'M12 3l8 3v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3z',
  good: 'M5 12.5l4.2 4.2L19 7',
} as const;

export function Notice({ tone = 'info', children }: { tone?: keyof typeof ICONS; children: ReactNode }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'warn' ? 'note' : undefined}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={ICONS[tone]} />
      </svg>
      <div>{children}</div>
    </div>
  );
}

/** Renders "[text](url)" links in schema labels. {privacy}/{terms} resolve from public config; a missing URL renders plain text. */
export function Inline({ text, vars }: { text: string; vars: Record<string, string | undefined> }) {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const key = m[2].replace(/[{}]/g, '');
    const url = m[2].startsWith('{') ? vars[key] : m[2];
    parts.push(
      url ? (
        <a key={i++} href={url} target="_blank" rel="noreferrer">
          {m[1]}
        </a>
      ) : (
        m[1]
      ),
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export const publicConfig = {
  privacyUrl: process.env.NEXT_PUBLIC_PRIVACY_URL || '/privacy',
  termsUrl: process.env.NEXT_PUBLIC_TERMS_URL || undefined,
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || undefined,
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
};
