import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPanel } from '@/components/AdminPanel';
import { SignOut } from '@/components/SignOut';
import { Header } from '@/components/ui';
import { computeFlags } from '@/lib/form/flags';
import { buildSummary } from '@/lib/form/summary';
import { requireAdminPage } from '@/lib/server/auth';
import { getSubmission } from '@/lib/server/repo';
import { statusLabel } from '@/lib/server/workflow';

export const dynamic = 'force-dynamic';

const fmt = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const EMAIL_LABEL: Record<string, string> = { sent: 'Sent', not_configured: 'Not sent (email not configured)', failed: 'Failed', pending: 'Pending' };

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const sub = getSubmission(id);
  if (!sub) notFound();

  const flags = computeFlags(sub.data, sub.files);
  const sections = buildSummary(sub.data, sub.files);
  const images = sub.files.filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.mime));
  const others = sub.files.filter((f) => !images.includes(f));

  return (
    <>
      <Header right={<SignOut />} />
      <main className="admin-wrap">
        <p className="small"><Link href="/admin">← All submissions</Link></p>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem' }}>{sub.businessName}</h1>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              <code>{sub.publicId}</code> · <span className={`status-chip s-${sub.status}`}>{statusLabel(sub.status)}</span> · Submitted {fmt(sub.submittedAt)}
            </p>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              {sub.contactName} · <a href={`mailto:${sub.contactEmail}`}>{sub.contactEmail}</a> · Profile owner: {String(sub.data.ownerName ?? '')}{sub.data.completedBy ? ` · Completed by ${String(sub.data.completedBy)}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="btn secondary small" href={`/api/admin/submissions/${sub.id}/export?format=pdf`}>Download PDF</a>
            <a className="btn secondary small" href={`/api/admin/submissions/${sub.id}/export?format=json`}>Download JSON</a>
          </div>
        </div>

        <div className="admin-grid">
          <div className="stack">
            <section className="card"><div className="card-body" style={{ padding: 16 }}>
              <h2 className="section-title">Follow-up flags ({flags.length})</h2>
              {flags.map((f) => (
                <div className="flag" key={f.id}>
                  <span className={`sev ${f.severity}`}>{f.severity}</span>
                  <span><span className="muted small">{f.category} · </span>{f.message}</span>
                </div>
              ))}
            </div></section>

            <section className="card"><div className="card-body" style={{ padding: 16 }}>
              <h2 className="section-title">Locations ({sub.locations.length})</h2>
              {sub.locations.length === 0 && <p className="muted">No physical address provided.</p>}
              {sub.locations.map((l, i) => (
                <div key={i} className="flag" style={{ display: 'block' }}>
                  <strong>{l.label}</strong> <span className="muted small">({l.kind}{l.addressHidden === true ? ', address to be hidden' : l.addressHidden === false ? ', address to be shown' : ''})</span>
                  <div>{[l.address.street, l.address.unit, l.city, l.region, l.address.zip, l.country].filter(Boolean).join(', ')}</div>
                </div>
              ))}
            </div></section>

            {sections.map((s) => (
              <section className="review-section" key={s.stepId} style={{ background: '#fff', marginTop: 0 }}>
                <div className="review-head"><h3>{s.title}</h3></div>
                <dl className="review-rows">
                  {s.rows.map((r) => (
                    <div className="review-row" key={r.id}>
                      <dt>{r.label}</dt>
                      <dd className={r.skipped ? 'skipped' : undefined}>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}

            <section className="card"><div className="card-body" style={{ padding: 16 }}>
              <h2 className="section-title">Uploaded media ({sub.files.length})</h2>
              <p className="small muted">Media status: <strong>{String(sub.data.mediaStatus ?? 'not answered')}</strong>.</p>
              <div className="thumbs">
                {images.map((f) => (
                  <a key={f.id} href={`/api/admin/files/${f.id}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/admin/files/${f.id}`} alt={f.name} loading="lazy" />
                    <span>{f.category}: {f.name}</span>
                  </a>
                ))}
              </div>
              {others.length > 0 && (
                <ul>{others.map((f) => <li key={f.id}><a href={`/api/admin/files/${f.id}?download=1`}>{f.category}: {f.name}</a> <span className="muted small">({(f.size / 1024 / 1024).toFixed(1)} MB)</span></li>)}</ul>
              )}
            </div></section>

            <section className="card"><div className="card-body" style={{ padding: 16 }}>
              <h2 className="section-title">System log</h2>
              <p className="small">
                Client confirmation email: <strong>{EMAIL_LABEL[sub.emailStatus.client] ?? sub.emailStatus.client}</strong>{sub.emailStatus.clientError ? ` (${sub.emailStatus.clientError})` : ''}<br />
                Arclo notification email: <strong>{EMAIL_LABEL[sub.emailStatus.notify] ?? sub.emailStatus.notify}</strong>{sub.emailStatus.notifyError ? ` (${sub.emailStatus.notifyError})` : ''}
              </p>
              {sub.audit.map((a, i) => <div className="small muted" key={i}>{fmt(a.ts)} · {a.actor} · {a.action}{a.detail ? ` · ${a.detail}` : ''}</div>)}
            </div></section>
          </div>

          <AdminPanel id={sub.id} status={sub.status} checklist={sub.checklist} notes={sub.notes} />
        </div>
      </main>
    </>
  );
}
