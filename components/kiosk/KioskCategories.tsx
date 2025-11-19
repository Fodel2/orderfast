import KioskCategoryTile from './KioskCategoryTile';

interface KioskCategoriesProps {
  categories: { id: number; name: string; image_url?: string | null }[];
  activeCategoryId?: number | null;
  onSelect?: (categoryId: number) => void;
}

export default function KioskCategories({ categories, activeCategoryId, onSelect }: KioskCategoriesProps) {
  return (
    <div className="-mx-4 overflow-x-auto pb-3 sm:-mx-6" role="tablist" aria-label="Categories">
      <div className="flex min-h-[56px] items-center gap-3 px-4 sm:min-h-[60px] sm:gap-4 sm:px-6">
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
