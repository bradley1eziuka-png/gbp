'use client';

import Link from 'next/link';
import { useState } from 'react';
import { publicConfig } from './ui';

export function StartScreen({ onStart }: { onStart: (name: string, email: string, honeypot: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Please enter your name and a valid email address.');
      return;
    }
    onStart(name.trim(), email.trim(), hp);
  };

  return (
    <div className="hero">
      <h1>Google Business Profile Setup</h1>
      <p className="sub">We’ll handle setting up your Google Business Profile. We just need a few details about your business to make sure everything is accurate.</p>
      <div className="pill-row">
        <span className="pill">About 5–10 minutes</span>
      </div>
      <div className="card">
        <div className="card-body">
          <p className="small muted" style={{ marginTop: 0 }}>
            Your answers are kept in this browser tab while you work, and are sent to Arclo only when you submit. We never ask for passwords, verification codes, or
            financial details.
          </p>
          <form onSubmit={start} style={{ marginTop: 24, display: 'grid', gap: 16 }} noValidate>
            <div>
              <label className="lbl" htmlFor="s-name">Your name <span className="req" aria-hidden="true">*</span></label>
              <input id="s-name" type="text" autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="s-email">Your email <span className="req" aria-hidden="true">*</span></label>
              <p className="help">So Arclo can reach you about your profile. It is not shown on Google.</p>
              <input id="s-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="hp" aria-hidden="true">
              <label>Leave this field empty <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></label>
            </div>
            {error && <div className="error-summary" role="alert" style={{ marginTop: 0 }}>{error}</div>}
            <div><button className="btn" type="submit">Start setup</button></div>
            <p className="small muted" style={{ margin: 0 }}>See our <Link href={publicConfig.privacyUrl}>privacy notice</Link>.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
