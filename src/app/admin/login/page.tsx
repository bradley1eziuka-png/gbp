import { AdminLogin } from '@/components/AdminLogin';
import { Header } from '@/components/ui';
import { adminConfig } from '@/lib/server/config';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const configured = !!adminConfig();
  return (
    <>
      <Header />
      <main className="shell">
        <div className="card login-card">
          <div className="card-body">
            <h1 className="step-title" style={{ fontSize: '1.375rem' }}>Arclo admin</h1>
            {configured ? (
              <AdminLogin />
            ) : (
              <p>
                Admin sign-in is not configured. Set <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD_HASH</code> in the server environment (see README → Configuration), then restart.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
