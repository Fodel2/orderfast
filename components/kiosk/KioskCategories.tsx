import KioskCategoryTile from './KioskCategoryTile';

interface KioskCategoriesProps {
  categories: { id: number; name: string; image_url?: string | null }[];
  activeCategoryId?: number | null;
  onSelect?: (categoryId: number) => void;
}

export default function KioskCategories({ categories, activeCategoryId, onSelect }: KioskCategoriesProps) {
  return (
    <div className="CategoryBarWrapper">
      <div className="CategoryBarInner" role="tablist" aria-label="Categories">
        {categories.map((category) => (
          <KioskCategoryTile
            key={category.id}
            category={category}
            active={category.id === activeCategoryId}
            onSelect={onSelect}
          />
        ))}
      </div>

      <style jsx>{`
        .CategoryBarWrapper {
          position: sticky;
          top: 0;
          z-index: 50;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 1));
          backdrop-filter: blur(8px);
          padding-bottom: 14px;
          box-shadow: 0px 6px 18px rgba(0, 0, 0, 0.06);
        }

        .CategoryBarInner {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 12px 4px;
          scroll-snap-type: x mandatory;
          align-items: center;
          min-width: 100%;
          white-space: nowrap;
          scrollbar-width: none;
        }

        .CategoryBarInner::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
