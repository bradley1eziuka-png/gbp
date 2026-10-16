'use client';

import { useRouter } from 'next/navigation';

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="header-link"
      onClick={async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        router.push('/admin/login');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
