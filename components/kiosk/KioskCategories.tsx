import { useEffect, useMemo, useRef } from 'react';
import KioskCategoryTile from './KioskCategoryTile';

interface KioskCategoriesProps {
  categories: { id: number; name: string; image_url?: string | null }[];
  activeCategoryId?: number | null;
  onSelect?: (categoryId: number) => void;
}

export default function KioskCategories({ categories, activeCategoryId, onSelect }: KioskCategoriesProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const orderedCategories = useMemo(() => categories, [categories]);

  useEffect(() => {
    if (activeCategoryId == null) return;
    const btn = buttonRefs.current[activeCategoryId];
    if (!btn) return;
    const container = containerRef.current;
    if (!container) return;

    const btnRect = btn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const isFullyVisible = btnRect.left >= containerRect.left && btnRect.right <= containerRect.right;

    if (!isFullyVisible) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategoryId]);

  return (
    <div className="z-40 bg-white border-b border-neutral-200" role="tablist" aria-label="Categories">
      <div ref={containerRef} className="overflow-x-auto pb-3 scroll-smooth">
        <div className="flex min-h-[64px] items-center gap-3 px-4 sm:min-h-[64px] sm:gap-4 sm:px-6 snap-x snap-mandatory">
          {orderedCategories.map((category) => (
            <KioskCategoryTile
              key={category.id}
              category={category}
              active={category.id === activeCategoryId}
              onSelect={onSelect}
              className="snap-start"
              buttonRef={(el) => {
                buttonRefs.current[category.id] = el;
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
