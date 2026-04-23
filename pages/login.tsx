import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import NonFullscreenRestaurantShell from '@/components/layouts/NonFullscreenRestaurantShell';

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
    <NonFullscreenRestaurantShell contentClassName="flex min-h-[calc(100vh-180px)] items-center" maxWidthClassName="max-w-[420px]">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Orderfast</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Login</h1>
        <form className="mt-5" onSubmit={handleLogin}>
          <div className="mb-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="mb-4">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-black"
          >
            Log In
          </button>
        </form>
      </section>
    </NonFullscreenRestaurantShell>
  );
}
