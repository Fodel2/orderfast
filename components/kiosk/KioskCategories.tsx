import KioskCategoryTile from './KioskCategoryTile';

interface KioskCategoriesProps {
  categories: { id: number; name: string; image_url?: string | null }[];
  activeCategoryId?: number | null;
  onSelect?: (categoryId: number) => void;
}

export default function KioskCategories({ categories, activeCategoryId, onSelect }: KioskCategoriesProps) {
  return (
    <div
      className="overflow-x-auto pb-1"
      role="tablist"
      aria-label="Categories"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      <div
        className="inline-flex min-w-full items-center gap-3 whitespace-nowrap px-1 sm:px-2"
        style={{ background: '#ffffff' }}
      >
        {categories.map((category) => (
          <KioskCategoryTile
            key={category.id}
            category={category}
            active={category.id === activeCategoryId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
