'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { publicConfig } from './ui';

const TOKEN_KEY = 'arclo.gbp.token';

export function StartForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [cf, setCf] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
    try {
      setExisting(localStorage.getItem(TOKEN_KEY));
    } catch {}
    (window as unknown as { onTurnstile?: (t: string) => void }).onTurnstile = (t: string) => setCf(t);
  }, []);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, hp, ts: shownAt.current, cf: cf || undefined }),
      });
      const body = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !body.token) throw new Error(body.error ?? 'Could not start the form.');
      try {
        localStorage.setItem(TOKEN_KEY, body.token);
      } catch {}
      router.push(`/form/${body.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the form.');
      setBusy(false);
    }
  };

  return (
    <div className="hero">
      <h1>Google Business Profile Setup</h1>
      <p className="sub">We’ll handle setting up your Google Business Profile. We just need a few details about your business to make sure everything is accurate.</p>

      <div className="pill-row">
        <span className="pill">About 5–10 minutes</span>
      </div>

      {existing && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <strong>Welcome back.</strong> You have a form in progress on this device.
          <div style={{ marginTop: 10 }}>
            <Link className="btn" href={`/form/${existing}`}>Continue where I left off</Link>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <p className="small muted" style={{ marginTop: 0 }}>
            Your progress saves automatically. We never ask for passwords, verification codes, or financial details.
          </p>

          <form onSubmit={start} style={{ marginTop: 24, display: 'grid', gap: 16 }}>
            <div>
              <label className="lbl" htmlFor="s-name">Your name <span className="req" aria-hidden="true">*</span></label>
              <input id="s-name" type="text" autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="s-email">Your email <span className="req" aria-hidden="true">*</span></label>
              <p className="help">We’ll email you a link to resume later. It is not shown on Google.</p>
              <input id="s-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="hp" aria-hidden="true">
              <label>Leave this field empty <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></label>
            </div>
            {publicConfig.turnstileSiteKey && (
              <>
                <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
                <div className="cf-turnstile" data-sitekey={publicConfig.turnstileSiteKey} data-callback="onTurnstile" />
              </>
            )}
            {error && <div className="error-summary" role="alert" style={{ marginTop: 0 }}>{error}</div>}
            <div>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Starting…' : 'Start setup'}</button>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              See our <Link href={publicConfig.privacyUrl}>privacy notice</Link>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
