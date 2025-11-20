import Button from '@/components/ui/Button';
import { normalizeSource } from '@/lib/media/placeholders';
import { cn } from '@/lib/utils';

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
    <Button
      type="button"
      variant="secondary"
      size="lg"
      onClick={handleClick}
      className={cn(
        'flex min-h-[52px] items-center gap-3 whitespace-nowrap px-4 text-left sm:min-h-[60px] sm:px-5',
        active
          ? 'border-[var(--kiosk-accent,#111827)] bg-white shadow-md ring-2 ring-[var(--kiosk-accent,#111827)]/15'
          : 'border-neutral-200 bg-white/90 shadow-sm hover:bg-white',
        'transition-all duration-200 ease-out'
      )}
    >
      {categoryImage ? (
        <span className="relative h-10 w-10 overflow-hidden rounded-2xl bg-white shadow-sm sm:h-11 sm:w-11">
          <img src={categoryImage} alt={category.name} className="h-full w-full object-cover" loading="lazy" />
        </span>
      ) : null}
      <span className="text-sm font-semibold leading-tight text-neutral-900 sm:text-base">{category.name}</span>
    </Button>
  );
}
