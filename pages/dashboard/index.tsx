import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import TaskLogger from '@/components/TaskLogger';

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
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Restaurant Dashboard</h1>
        <div className="mt-6">
          <TaskLogger />
        </div>
        <p className="mb-6 mt-6">
          Welcome, <strong>{userEmail}</strong>
        </p>
        <button
          onClick={handleSignOut}
          className="mb-8 px-4 py-2 bg-black text-white rounded"
        >
          Sign Out
        </button>
        <hr className="my-8" />
        <h2 className="text-xl font-semibold mb-2">Coming Soon:</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>🧾 Menu manager</li>
          <li>📸 Logo uploader</li>
          <li>📦 Orders</li>
          <li>🏬 Printer integration</li>
        </ul>
      </div>
    </DashboardLayout>
  );
}
