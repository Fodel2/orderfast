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
        background: '#f8fafc',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.15rem)',
        paddingRight: '1rem',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.15rem)',
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
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '24px',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.09)',
          padding: '1.25rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.72rem', letterSpacing: '0.08em', color: '#6b7280', fontWeight: 700 }}>ORDERFAST</p>
        <h1 style={{ margin: '0.4rem 0 0', fontSize: '1.5rem', color: '#111827' }}>Sign in</h1>
        <p style={{ margin: '0.45rem 0 1rem', color: '#4b5563', fontSize: '0.92rem' }}>Use your dashboard credentials to continue.</p>

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
                padding: '0.72rem 0.9rem',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                fontSize: '0.92rem',
                backgroundColor: '#fff',
                color: '#374151',
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
                padding: '0.72rem 0.9rem',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                fontSize: '0.92rem',
                backgroundColor: '#fff',
                color: '#374151',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.78rem 1rem',
              background: '#0d9488',
              color: '#fff',
              border: 'none',
              borderRadius: '999px',
              fontSize: '0.92rem',
              fontWeight: 700,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.12)',
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
