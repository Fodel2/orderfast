import { useRouter } from 'next/router';
import FullscreenAppLayout from '@/components/layouts/FullscreenAppLayout';

export default function PosHomePage() {
  const router = useRouter();

  return (
    <FullscreenAppLayout>
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-full max-w-md space-y-3">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-600">
            Till / POS
          </span>
          <h1 className="text-3xl font-semibold text-gray-900">Till / POS</h1>
          <p className="text-base text-gray-500">Sell screen (MVP shell)</p>
        </div>

        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mt-10 rounded-full border border-gray-200 bg-white px-6 py-3 text-base font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
        >
          Exit to Dashboard
        </button>
      </div>
    </FullscreenAppLayout>
  );
}
