import { cn } from '@/lib/utils';
import { normalizeSource } from '@/lib/media/placeholders';

interface KioskCategoryTileProps {
  category: {
    id: number;
    name: string;
    image_url?: string | null;
  };
  active?: boolean;
  onSelect?: (categoryId: number) => void;
  className?: string;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}

export default function KioskCategoryTile({
  category,
  active = false,
  onSelect,
  className,
  buttonRef,
}: KioskCategoryTileProps) {
  const categoryImage = category.image_url ? normalizeSource(category.image_url) : null;

  const handleClick = () => {
    onSelect?.(category.id);
  };

  const baseClasses =
    'inline-flex min-h-[58px] shrink-0 items-center justify-center gap-3 whitespace-nowrap rounded-full px-6 py-3 text-base font-semibold tracking-wide transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kiosk-accent,#111827)]/40 sm:min-h-[64px] sm:px-7';

  const activeClasses =
    'border border-transparent bg-[var(--kiosk-accent,#111827)] text-white shadow-lg shadow-black/10 scale-[1.03] hover:brightness-110 active:translate-y-px';

  const inactiveClasses =
    'border border-neutral-200 bg-white text-neutral-900 shadow-sm hover:bg-neutral-50 hover:translate-y-[1px]';

  return (
    <button
      type="button"
      onClick={handleClick}
      ref={buttonRef}
      className={cn(
        baseClasses,
        active ? activeClasses : inactiveClasses,
        'scroll-mx-3 scroll-my-2 snap-center',
        className
      )}
    >
      {categoryImage ? (
        <span className="relative h-10 w-10 overflow-hidden rounded-xl bg-white shadow-sm sm:h-11 sm:w-11">
          <img src={categoryImage} alt={category.name} className="h-full w-full object-cover" loading="lazy" />
        </span>
      ) : null}
      <span
        className={cn(
          'text-sm font-semibold leading-tight sm:text-base',
          active ? 'text-white' : 'text-neutral-900'
        )}
      >
        {category.name}
      </span>
    </button>
  );
}
