import { normalizeSource } from '@/lib/media/placeholders';

interface KioskCategoryTileProps {
  category: {
    id: number;
    name: string;
    image_url?: string | null;
  };
  onSelect?: (categoryId: number) => void;
}

export default function KioskCategoryTile({ category, onSelect }: KioskCategoryTileProps) {
  const categoryImage = category.image_url ? normalizeSource(category.image_url) : null;

  const handleClick = () => {
    onSelect?.(category.id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white/85 p-4 text-left shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kiosk-accent,#111827)]/30 sm:gap-5 sm:p-5 backdrop-blur"
      style={{ minHeight: '84px' }}
    >
      {categoryImage ? (
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-white/60 shadow-inner">
          <img src={categoryImage} alt={category.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : null}
      <div className="flex min-h-[64px] flex-1 items-center">
        <span className="text-lg font-semibold leading-tight text-neutral-900">{category.name}</span>
      </div>
    </button>
  );
}
