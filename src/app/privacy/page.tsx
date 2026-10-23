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
            <p>The details you enter: business name, phone, address (including a home-based business address), website, hours, services, the owner’s name, Google account email, and phone, plus optional logo and photos.</p>
            <h2 className="section-title">What we do not collect</h2>
            <p>Passwords, verification codes, identity documents, tax or Social Security numbers, or bank details.</p>
            <h2 className="section-title">How it is handled</h2>
            <p>While you fill in the form, your answers stay in your browser tab. When you press Submit they are sent securely to Arclo through Formspree, our form-handling provider, and are used only to create and manage your Google Business Profile and to contact you about it. Nothing is sent before you submit.</p>
            <h2 className="section-title">Your choices</h2>
            <p>Contact Arclo to ask for access to, correction of, or deletion of what you submitted.</p>
          </div></div>
        </div>
      </main>
    </>
  );
}
