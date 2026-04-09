import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace('/jobs'); }, []);
  return (
    <div style={{ background: '#162b3e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#fef2de', fontFamily: 'sans-serif', fontSize: 14 }}>Loading...</div>
    </div>
  );
}
