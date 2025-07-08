import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState('');
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      setUserEmail(session.user.email);
    };

    getUser();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Restaurant Dashboard</h1>
      <p>Welcome, <strong>{userEmail}</strong></p>

      <button
        onClick={handleSignOut}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: 'black',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Sign Out
      </button>

      <hr style={{ margin: '2rem 0' }} />

      <h2>Coming Soon:</h2>
      <ul>
        <li>🧾 Menu manager</li>
        <li>📸 Logo uploader</li>
        <li>📦 Orders</li>
        <li>🏬 Printer integration</li>
      </ul>
    </div>
  );
}
