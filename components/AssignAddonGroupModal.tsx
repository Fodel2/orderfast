import { useEffect, useMemo, useRef, useState } from 'react';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { updateAddonGroupAssignments } from '../utils/updateAddonGroupAssignments';

type MenuCategory = {
  id: string;
  name: string;
};

type MenuItem = {
  id: string;
  name: string;
  category_id: string | null;
  external_key?: string | null;
};

type AssignAddonGroupModalProps = {
  show: boolean;
  restaurantId: string;
  groupId: string;
  categories: MenuCategory[];
  items: MenuItem[];
  initialSelectedItemIds: string[];
  onClose: () => void;
  onSaved: (itemIds: string[], externalKeyMap: Record<string, string>) => void;
};

function CategoryCheckbox({
  id,
  label,
  checked,
  indeterminate,
  onChange,
  onClick,
}: {
  id: string;
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !!indeterminate && !checked;
    }
  }, [indeterminate, checked]);

  return (
    <label className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer gap-2">
      <div className="flex items-center gap-3">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          onClick={onClick}
          className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
        />
        <span className="text-sm font-medium text-gray-800">{label}</span>
      </div>
      {checked && !indeterminate ? (
        <CheckCircleIcon className="h-4 w-4 text-teal-600" />
      ) : null}
    </label>
  );
}

export default function AssignAddonGroupModal({
  show,
  restaurantId,
  groupId,
  categories,
  items,
  initialSelectedItemIds,
  onClose,
  onSaved,
}: AssignAddonGroupModalProps) {
  const normalizedItems = useMemo(
    () => items.map((it) => ({ ...it, id: String(it.id), category_id: it.category_id ? String(it.category_id) : null })),
    [items]
  );

  const groupedItems = useMemo(() => {
    const group: Record<string, MenuItem[]> = {};
    normalizedItems.forEach((item) => {
      const catId = item.category_id || 'uncategorized';
      if (!group[catId]) group[catId] = [];
      group[catId].push(item);
    });
    return group;
  }, [normalizedItems]);

  const categoriesWithFallback = useMemo(() => {
    const normalizedCategories = categories.map((cat) => ({ id: String(cat.id), name: cat.name }));
    const hasUncategorized = groupedItems.uncategorized && groupedItems.uncategorized.length > 0;
    return hasUncategorized
      ? [...normalizedCategories, { id: 'uncategorized', name: 'Uncategorized' }]
      : normalizedCategories;
  }, [categories, groupedItems]);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedItems(new Set(initialSelectedItemIds.map(String)));
  }, [initialSelectedItemIds]);

  useEffect(() => {
    if (!activeCategoryId && categoriesWithFallback.length) {
      setActiveCategoryId(categoriesWithFallback[0].id);
    }
  }, [categoriesWithFallback, activeCategoryId]);

  if (!show) return null;

  const itemsForCategory = useMemo(
    () => (activeCategoryId ? groupedItems[activeCategoryId] || [] : []),
    [activeCategoryId, groupedItems]
  );

  const toggleCategory = (catId: string, isChecked: boolean) => {
    const updated = new Set(selectedItems);
    const catItems = groupedItems[catId] || [];
    if (isChecked) {
      catItems.forEach((item) => updated.add(item.id));
    } else {
      catItems.forEach((item) => updated.delete(item.id));
    }
    setSelectedItems(updated);
    setActiveCategoryId(catId);
  };

  const toggleItem = (itemId: string, isChecked: boolean) => {
    const updated = new Set(selectedItems);
    if (isChecked) {
      updated.add(itemId);
    } else {
      updated.delete(itemId);
    }
    setSelectedItems(updated);
  };

  const selectAllItems = () => {
    const updated = new Set(selectedItems);
    itemsForCategory.forEach((item) => updated.add(item.id));
    setSelectedItems(updated);
  };

  const deselectAllItems = () => {
    const updated = new Set(selectedItems);
    itemsForCategory.forEach((item) => updated.delete(item.id));
    setSelectedItems(updated);
  };

  const saveAssignments = async () => {
    try {
      setSaving(true);
      const selectedIds = Array.from(selectedItems);
      const selectedItemRecords = normalizedItems.filter((item) => selectedIds.includes(item.id));
      const { externalKeyMap } = await updateAddonGroupAssignments({
        restaurantId,
        groupId,
        items: selectedItemRecords,
      });
      onSaved(selectedIds, externalKeyMap);
      onClose();
    } catch (error) {
      console.error('[assign-addon-group-modal] save failed', error);
      alert('Failed to save assignments. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const categoryStates = useMemo(() => {
    return categoriesWithFallback.map((cat) => {
      const catItems = groupedItems[cat.id] || [];
      const selectedCount = catItems.filter((it) => selectedItems.has(it.id)).length;
      const allSelected = catItems.length > 0 && selectedCount === catItems.length;
      const partiallySelected = selectedCount > 0 && selectedCount < catItems.length;
      return { id: cat.id, name: cat.name, allSelected, partiallySelected };
    });
  }, [categoriesWithFallback, groupedItems, selectedItems]);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-start justify-center bg-black/60 px-4 py-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative mt-4 mb-8 flex w-full max-w-5xl max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Assign Add-on Group</p>
            <h3 className="text-xl font-semibold text-gray-900">Choose where this group appears</h3>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-[280px_1fr] md:gap-6">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 shadow-inner">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Categories</p>
              <div className="divide-y divide-gray-100 overflow-y-auto rounded-xl bg-white shadow-sm max-h-[420px]">
                {categoryStates.map((cat) => (
                  <CategoryCheckbox
                    key={cat.id}
                    id={cat.id}
                    label={cat.name}
                    checked={cat.allSelected}
                    indeterminate={cat.partiallySelected}
                    onChange={(checked) => toggleCategory(cat.id, checked)}
                    onClick={() => setActiveCategoryId(cat.id)}
                  />
                ))}
                {!categoryStates.length && (
                  <div className="px-4 py-6 text-center text-sm text-gray-500">No categories available</div>
                )}
              </div>
            </div>

            <div className="flex min-h-[360px] flex-col rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Items</p>
                  <h4 className="text-sm font-semibold text-gray-900">
                    {categoriesWithFallback.find((c) => c.id === activeCategoryId)?.name || 'Select a category'}
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-teal-700">
                  <button type="button" onClick={selectAllItems} className="hover:underline">Select All</button>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={deselectAllItems} className="hover:underline">Deselect All</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {itemsForCategory.length ? (
                  <ul className="divide-y divide-gray-100">
                    {itemsForCategory.map((item) => (
                      <li key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            checked={selectedItems.has(item.id)}
                            onChange={(e) => toggleItem(item.id, e.target.checked)}
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex h-full items-center justify-center px-4 py-6 text-sm text-gray-500">
                    No items in this category
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t bg-white px-6 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 md:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveAssignments}
            disabled={saving}
            className="w-full rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
          >
            {saving ? 'Saving...' : 'Save Assignments'}
          </button>
        </div>
      </div>
    </div>
  );
}
