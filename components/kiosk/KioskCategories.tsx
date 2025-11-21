import KioskCategoryTile from './KioskCategoryTile';

interface KioskCategoriesProps {
  categories: { id: number; name: string; image_url?: string | null }[];
  activeCategoryId?: number | null;
  onSelect?: (categoryId: number) => void;
}

export default function KioskCategories({ categories, activeCategoryId, onSelect }: KioskCategoriesProps) {
  return (
    <div
      className="flex flex-wrap gap-3 overflow-x-auto bg-white px-4 py-3 sm:px-6 md:flex-nowrap"
      role="tablist"
      aria-label="Categories"
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
  );
}
