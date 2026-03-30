import { useRouter } from 'next/router';
import FullscreenAppLayout from '@/components/layouts/FullscreenAppLayout';

export default function PosPaymentEntryPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;

  return (
    <FullscreenAppLayout
      promptTitle="Tap to enter fullscreen"
      promptDescription="Keep POS payment entry immersive while this shell is being wired."
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">POS payment entry</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">POS payment shell ready</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            This route is reserved for POS-only payment UI handoff. It intentionally contains no live payment integrations yet.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                if (!restaurantId) return;
                router.push(`/pos/${restaurantId}`).catch(() => undefined);
              }}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Back to POS
            </button>
          </div>
        </section>
      </div>
    </FullscreenAppLayout>
  );
}
