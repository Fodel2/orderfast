import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const supabase = useSupabaseClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      alert('Login failed: ' + (error?.message || 'No session returned'));
      return;
    }

    const redirectTo =
      typeof router.query.redirect === 'string'
        ? router.query.redirect
        : '/dashboard';
    await router.replace(redirectTo);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const redirectTo =
          typeof router.query.redirect === 'string'
            ? router.query.redirect
            : '/dashboard';
        router.replace(redirectTo);
      }
    });
  }, [router, supabase]);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #eef2ff 0%, #f8fafc 48%, #e2e8f0 100%)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.4rem)',
        paddingRight: '1rem',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.6rem)',
        paddingLeft: '1rem',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '410px',
          background: 'rgba(255,255,255,0.94)',
          border: '1px solid #dbeafe',
          borderRadius: '18px',
          boxShadow: '0 16px 38px rgba(15, 23, 42, 0.09)',
          padding: '1.15rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.76rem', letterSpacing: '0.08em', color: '#475569', fontWeight: 700 }}>ORDERFAST</p>
        <h1 style={{ margin: '0.4rem 0 0', fontSize: '1.5rem', color: '#0f172a' }}>Sign in</h1>
        <p style={{ margin: '0.45rem 0 1rem', color: '#475569', fontSize: '0.92rem' }}>Use your dashboard credentials to continue.</p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '0.8rem' }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.72rem 0.82rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                backgroundColor: '#fff',
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.72rem 0.82rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                backgroundColor: '#fff',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.72rem 1rem',
              background: 'linear-gradient(135deg, #0f172a, #1e293b)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.96rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Log In
          </button>
        </form>
      </section>
    </main>
  );
}
