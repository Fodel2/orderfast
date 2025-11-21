import KioskCategoryTile from './KioskCategoryTile';

interface KioskCategoriesProps {
  categories: { id: number; name: string; image_url?: string | null }[];
  activeCategoryId?: number | null;
  onSelect?: (categoryId: number) => void;
}

export default function KioskCategories({ categories, activeCategoryId, onSelect }: KioskCategoriesProps) {
  return (
    <div className="overflow-x-auto" role="tablist" aria-label="Categories">
      <div className="inline-flex min-w-full items-center gap-4 whitespace-nowrap px-4 py-2 sm:px-6">
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
