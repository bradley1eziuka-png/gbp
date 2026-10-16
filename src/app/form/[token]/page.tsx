import { Wizard } from '@/components/Wizard';

export const metadata = { referrer: 'no-referrer' as const };

export default async function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <Wizard token={token} />;
}
