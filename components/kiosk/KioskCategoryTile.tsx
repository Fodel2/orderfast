import { normalizeSource } from '@/lib/media/placeholders';

interface KioskCategoryTileProps {
  category: {
    id: number;
    name: string;
    image_url?: string | null;
  };
  active?: boolean;
  onSelect?: (categoryId: number) => void;
}

export default function KioskCategoryTile({ category, active = false, onSelect }: KioskCategoryTileProps) {
  const categoryImage = category.image_url ? normalizeSource(category.image_url) : null;

  const handleClick = () => {
    onSelect?.(category.id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex min-h-[52px] items-center gap-3 rounded-full border px-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kiosk-accent,#111827)]/30 sm:min-h-[60px] sm:px-5 ${
        active
          ? 'border-[var(--kiosk-accent,#111827)]/20 bg-white shadow-md'
          : 'border-neutral-200 bg-[#f7f7f7] hover:bg-white'
      }`}
    >
      {categoryImage ? (
        <div className="relative h-10 w-10 overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-inner sm:h-11 sm:w-11">
          <img src={categoryImage} alt={category.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : null}
      <div className="flex flex-1 items-center">
        <span className="text-sm font-semibold leading-tight text-neutral-900 sm:text-base">{category.name}</span>
      </div>
    </button>
  );
}
