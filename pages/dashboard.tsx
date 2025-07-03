import { useSession } from '@supabase/auth-helpers-react';

export default function Dashboard() {
  const session = useSession();

  if (!session) return <p className="text-center mt-10">You need to log in.</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Dashboard</h2>
      <p>Welcome, {session.user.email}</p>
      <p>This is where you'll manage your menu, orders, and settings.</p>
    </div>
  );
}