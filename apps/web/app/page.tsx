import { ApiHealth } from '@/components/ApiHealth';

export default function LandingPage() {
  return (
    <main>
      <h1>Uspomena</h1>
      <p>Digitalne pozivnice i album venčanja.</p>
      {process.env.NODE_ENV !== 'production' ? <ApiHealth /> : null}
    </main>
  );
}
