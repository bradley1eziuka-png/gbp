import Link from 'next/link';
import { Header } from '@/components/ui';
import { SignOut } from '@/components/SignOut';
import { requireAdminPage } from '@/lib/server/auth';
import { listInProgressDrafts, listSubmissions, statusCounts } from '@/lib/server/repo';
import { STATUSES, statusLabel } from '@/lib/server/workflow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Submissions | Arclo admin' };

const fmt = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminPage();
  const { status } = await searchParams;
  const inProgress = status === 'onboarding_incomplete';
  const subs = inProgress ? [] : listSubmissions(status);
  const drafts = inProgress ? listInProgressDrafts() : [];
  const counts = statusCounts();

  return (
    <>
      <Header right={<SignOut />} />
      <main className="admin-wrap">
        <h1 style={{ fontSize: '1.625rem' }}>GBP onboarding submissions</h1>
        <nav className="filter-row" aria-label="Filter by status">
          <Link href="/admin" aria-current={!status}>All</Link>
          <Link href="/admin?status=onboarding_incomplete" aria-current={inProgress}>Onboarding incomplete</Link>
          {STATUSES.map((s) => (
            <Link key={s.value} href={`/admin?status=${s.value}`} aria-current={status === s.value}>{s.label}{counts[s.value] ? ` (${counts[s.value]})` : ''}</Link>
          ))}
        </nav>

        <div className="card table-wrap">
          {inProgress ? (
            <table className="tbl">
              <thead><tr><th>Business</th><th>Contact</th><th>Last step</th><th>Last saved</th></tr></thead>
              <tbody>
                {drafts.length === 0 && <tr><td colSpan={4} className="muted">No forms in progress.</td></tr>}
                {drafts.map((d, i) => (
                  <tr key={i}>
                    <td>{d.business_name || <span className="muted">(not entered yet)</span>}</td>
                    <td>{d.contact_name}<br /><span className="muted small">{d.contact_email}</span></td>
                    <td>Step {d.step_index + 1}</td>
                    <td>{fmt(d.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="tbl">
              <thead><tr><th>Business</th><th>Reference</th><th>Status</th><th>Flags</th><th>Locations</th><th>Submitted</th></tr></thead>
              <tbody>
                {subs.length === 0 && <tr><td colSpan={6} className="muted">No submissions yet.</td></tr>}
                {subs.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/admin/${s.id}`}>{s.businessName}</Link><br /><span className="muted small">{s.contactName} · {s.contactEmail}</span></td>
                    <td><code>{s.publicId}</code></td>
                    <td><span className={`status-chip s-${s.status}`}>{statusLabel(s.status)}</span></td>
                    <td>{s.blockers > 0 && <span className="sev blocker">{s.blockers} blocker{s.blockers > 1 ? 's' : ''}</span>} {s.attention > 0 && <span className="sev attention">{s.attention} attention</span>}</td>
                    <td>{s.locationCount}</td>
                    <td>{fmt(s.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
