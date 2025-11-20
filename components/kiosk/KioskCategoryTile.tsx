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
  className?: string;
}

export default function KioskCategoryTile({ category, active = false, onSelect, className }: KioskCategoryTileProps) {
  const categoryImage = category.image_url ? normalizeSource(category.image_url) : null;

  const handleClick = () => {
    onSelect?.(category.id);
  };

  return (
    <Button
      type="button"
      variant={active ? 'primary' : 'secondary'}
      size="lg"
      onClick={handleClick}
      className={cn(
        'flex min-h-[52px] shrink-0 items-center gap-3 whitespace-nowrap px-4 text-left transition-all duration-200 ease-out sm:min-h-[60px] sm:px-6',
        active ? 'shadow-md' : 'shadow-sm',
        className
      )}
    >
      {categoryImage ? (
        <span className="relative h-10 w-10 overflow-hidden rounded-xl bg-white shadow-sm sm:h-11 sm:w-11">
          <img src={categoryImage} alt={category.name} className="h-full w-full object-cover" loading="lazy" />
        </span>
      ) : null}
      <span className="text-sm font-semibold leading-tight text-neutral-900 sm:text-base">{category.name}</span>
    </Button>
  );
}
