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
    <div style={{ padding: '2rem', maxWidth: '400px', margin: 'auto' }}>
      <h1>Login</h1>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'black',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Log In
        </button>
      </form>
    </div>
  );
}
