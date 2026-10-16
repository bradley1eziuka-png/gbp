'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CHECKLIST, STATUSES } from '@/lib/server/workflow';

interface Props {
  id: string;
  status: string;
  checklist: { key: string; done: boolean; doneAt: string | null; doneBy: string | null }[];
  notes: { id: string; author: string; body: string; createdAt: string }[];
}

export function AdminPanel({ id, status, checklist, notes }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const call = async (url: string, method: string, body: unknown) => {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Something went wrong.');
      return false;
    }
    router.refresh();
    return true;
  };
  const done = checklist.filter((c) => c.done).length;

  return (
    <div className="stack">
      {error && <div className="error-summary" role="alert" style={{ marginTop: 0 }}>{error}</div>}
      <section className="card"><div className="card-body" style={{ padding: 16 }}>
        <h2 className="section-title"><label htmlFor="status">Status</label></h2>
        <select id="status" value={status} disabled={busy} onChange={(e) => void call(`/api/admin/submissions/${id}`, 'PATCH', { status: e.target.value })}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div></section>

      <section className="card"><div className="card-body" style={{ padding: 16 }}>
        <h2 className="section-title">Setup checklist <span className="muted small">({done}/{CHECKLIST.length})</span></h2>
        {CHECKLIST.map((c) => {
          const s = checklist.find((x) => x.key === c.key);
          return (
            <label className="ck" key={c.key}>
              <input type="checkbox" checked={!!s?.done} disabled={busy} onChange={(e) => void call(`/api/admin/submissions/${id}/checklist`, 'POST', { key: c.key, done: e.target.checked })} />
              <span>
                {c.label}
                <span className="ck-hint" style={{ display: 'block' }}>{c.hint}</span>
                {s?.done && s.doneAt && <span className="ck-hint" style={{ display: 'block' }}>Done {new Date(s.doneAt).toLocaleString()} by {s.doneBy}</span>}
              </span>
            </label>
          );
        })}
      </div></section>

      <section className="card"><div className="card-body" style={{ padding: 16 }}>
        <h2 className="section-title"><label htmlFor="note">Internal notes</label></h2>
        <textarea id="note" value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} placeholder="Visible to Arclo staff only" />
        <button type="button" className="btn small" style={{ marginTop: 8 }} disabled={busy || !note.trim()} onClick={async () => { if (await call(`/api/admin/submissions/${id}/notes`, 'POST', { body: note })) setNote(''); }}>Add note</button>
        {notes.map((n) => (
          <div key={n.id} style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 10 }}>
            <div className="small muted">{n.author} · {new Date(n.createdAt).toLocaleString()}</div>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.body}</div>
          </div>
        ))}
      </div></section>
    </div>
  );
}
