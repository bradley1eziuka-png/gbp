import { Header } from '@/components/ui';

export const metadata = { title: 'Privacy notice | Arclo' };

/**
 * PLACEHOLDER WORDING describing what this system actually does.
 * Arclo must have this reviewed and replaced by its real privacy policy
 * (set NEXT_PUBLIC_PRIVACY_URL to point to it) before launch.
 */
export default function Privacy() {
  return (
    <>
      <Header />
      <main className="shell">
        <div className="hero">
          <div className="card"><div className="card-body">
            <h1 className="step-title">Privacy notice</h1>
            <p className="small" style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-line)', padding: 10, borderRadius: 8 }}>
              Draft wording describing how this form works. It has not been legally reviewed and should be replaced by Arclo’s official privacy policy before launch.
            </p>
            <h2 className="section-title" style={{ marginTop: 20 }}>What we collect</h2>
            <p>Business details, phone and email, address (including home-based business addresses), hours, services, the owner’s Google account email, and optional logo and photos.</p>
            <h2 className="section-title">What we do not collect</h2>
            <p>Passwords, two-factor or backup codes, security-question answers, identity documents, tax or Social Security numbers, or bank details.</p>
            <h2 className="section-title">How we use it</h2>
            <p>Only to create, claim, verify, optimise, and manage your Google Business Profile, and to contact you about that work.</p>
            <h2 className="section-title">How we protect it</h2>
            <p>Answers and files are encrypted at rest, stored privately (never in a public location), and only accessible to authorised Arclo staff after sign-in. Your in-progress form is saved on our server behind a private link, not in your browser.</p>
            <h2 className="section-title">Retention and your rights</h2>
            <p>In-progress forms expire 60 days after your last save. Contact Arclo to request access, correction, or deletion of what you have submitted.</p>
          </div></div>
        </div>
      </main>
    </>
  );
}
