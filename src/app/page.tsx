import { StartForm } from '@/components/StartForm';
import { Header } from '@/components/ui';

export default function Home() {
  return (
    <>
      <Header />
      <main className="shell">
        <StartForm />
      </main>
    </>
  );
}
