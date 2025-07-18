import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import CategoryMultiSelect from './CategoryMultiSelect';
import ItemMultiSelect from './ItemMultiSelect';

interface AddonGroupModalProps {
  show: boolean;
  restaurantId: number;
  group?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddonGroupModal({
  show,
  restaurantId,
  group,
  onClose,
  onSaved,
}: AddonGroupModalProps) {
  const [name, setName] = useState(group?.name || '');
  const [multipleChoice, setMultipleChoice] = useState<boolean>(!!group?.multiple_choice);
  const [required, setRequired] = useState<boolean>(!!group?.required);
  const [maxGroupSelect, setMaxGroupSelect] = useState<string>(
    group?.max_group_select != null ? String(group.max_group_select) : ''
  );
  const [maxOptionQuantity, setMaxOptionQuantity] = useState<string>(
    group?.max_option_quantity != null ? String(group.max_option_quantity) : ''
  );
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [itemCatLinks, setItemCatLinks] = useState<{
    item_id: number;
    category_id: number;
  }[]>([]);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  const getCatItemIds = (cats: number[]) => [
    ...items.filter((it) => cats.includes(it.category_id)).map((it) => it.id),
    ...itemCatLinks.filter((l) => cats.includes(l.category_id)).map((l) => l.item_id),
  ];

  const handleCategoryChange = (ids: number[]) => {
    setSelectedCats(ids);
    const toRemove = getCatItemIds(ids);
    setSelectedItems((prev) => prev.filter((id) => !toRemove.includes(id)));
  };

  const handleItemChange = (ids: number[]) => {
    const blocked = getCatItemIds(selectedCats);
    setSelectedItems(ids.filter((id) => !blocked.includes(id)));
  };

  useEffect(() => {
    if (!show) return;
    const load = async () => {
      const { data: catData } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true });
      setCategories(catData || []);
      const { data: itemData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId);
      setItems(itemData || []);

      let catLinks: { item_id: number; category_id: number }[] = [];
      if (itemData && itemData.length) {
        const { data: links } = await supabase
          .from('menu_item_categories')
          .select('item_id, category_id')
          .in('item_id', itemData.map((i: any) => i.id));
        catLinks = links || [];
        setItemCatLinks(catLinks);
      } else {
        setItemCatLinks([]);
      }
      if (group) {
        setName(group.name || '');
        setMultipleChoice(!!group.multiple_choice);
        setRequired(!!group.required);
        setMaxGroupSelect(
          group.max_group_select != null ? String(group.max_group_select) : ''
        );
        setMaxOptionQuantity(
          group.max_option_quantity != null
            ? String(group.max_option_quantity)
            : ''
        );
        const { data: links } = await supabase
          .from('item_addon_links')
          .select('item_id')
          .eq('group_id', group.id);
        const itemIds = links?.map((l: any) => l.item_id) || [];
        const fromPrimary = itemData
          ?.filter((it: any) => itemIds.includes(it.id))
          .map((it: any) => it.category_id) || [];
        const fromLinks = catLinks
          .filter((l) => itemIds.includes(l.item_id))
          .map((l) => l.category_id);
        const catIds = Array.from(new Set([...fromPrimary, ...fromLinks]));
        const catItemIds = [
          ...itemData.filter((it: any) => catIds.includes(it.category_id)).map((it: any) => it.id),
          ...catLinks.filter((l) => catIds.includes(l.category_id)).map((l) => l.item_id),
        ];
        setSelectedCats(catIds);
        setSelectedItems(itemIds.filter((id: number) => !catItemIds.includes(id)));
      } else {
        setName('');
        setMultipleChoice(false);
        setRequired(false);
        setMaxGroupSelect('');
        setMaxOptionQuantity('');
        setSelectedCats([]);
        setSelectedItems([]);
      }
    };
    load();
  }, [show, restaurantId, group]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('Name is required');
      return;
    }
    let groupId = group?.id;
    const parsedMaxGroup =
      maxGroupSelect === '' ? null : parseInt(maxGroupSelect, 10) || 0;
    const parsedMaxOption =
      maxOptionQuantity === '' ? null : parseInt(maxOptionQuantity, 10) || 0;

    if (group) {
      const { error } = await supabase
        .from('addon_groups')
        .update({
          name,
          multiple_choice: multipleChoice,
          required,
          max_group_select: parsedMaxGroup,
          max_option_quantity: parsedMaxOption,
        })
        .eq('id', group.id);
      if (error) {
        alert('Failed to save: ' + error.message);
        return;
      }
    } else {
      // Patch: add restaurant_id to addon_groups insert
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: restaurantUser, error: fetchError } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', user?.id)
        .single();

      console.log('Fetched restaurant user:', restaurantUser, fetchError);

      if (!restaurantUser) {
        alert('No restaurant found for this user.');
        return;
      }

      const payload = {
        name,
        multiple_choice: multipleChoice,
        required,
        restaurant_id: restaurantUser.restaurant_id,
        max_group_select: parsedMaxGroup,
        max_option_quantity: parsedMaxOption,
      };

      console.log('Inserting addon group:', payload);

      const { data, error: insertError } = await supabase
        .from('addon_groups')
        .insert([payload])
        .select();

      if (insertError) {
        console.error('Insert error:', insertError);
        alert('Insert failed. Check console for details.');
        return;
      }

      groupId = data?.[0]?.id;
    }

    if (!groupId) return;

    const catItemIds = getCatItemIds(selectedCats);
    const itemIds = Array.from(new Set([...selectedItems, ...catItemIds]));
    const { error: deleteError } = await supabase
      .from('item_addon_links')
      .delete()
      .eq('group_id', String(groupId));
    if (deleteError) {
      alert('Failed to update item links: ' + deleteError.message);
      return;
    }

    if (itemIds.length) {
      const { error: upsertError } = await supabase
        .from('item_addon_links')
        .upsert(
          itemIds.map((id) => ({
            item_id: String(id),
            group_id: String(groupId),
          })),
          { onConflict: 'item_id,group_id' }
        );
      if (upsertError) {
        alert('Failed to update item links: ' + upsertError.message);
        return;
      }
    }
    onSaved();
    onClose();
  };

  if (!show) return null;


  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold mb-4">{group ? 'Edit Add-on Category' : 'Add Add-on Category'}</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded p-2"
            />
          </div>
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={multipleChoice}
              onChange={(e) => setMultipleChoice(e.target.checked)}
            />
            <span>Multiple Choice</span>
          </label>
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            <span>Required</span>
          </label>
          <div>
            <label className="block text-sm font-medium mb-1">
              Max options from this group
            </label>
            <input
              type="number"
              min="0"
              value={maxGroupSelect}
              onChange={(e) => setMaxGroupSelect(e.target.value)}
              className="w-full border border-gray-300 rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Max quantity per option
            </label>
            <input
              type="number"
              min="0"
              value={maxOptionQuantity}
              onChange={(e) => setMaxOptionQuantity(e.target.value)}
              className="w-full border border-gray-300 rounded p-2"
            />
          </div>
          <div>
            <p className="font-semibold mb-1 text-sm">Assign to Categories</p>
            <CategoryMultiSelect
              categories={categories}
              selectedIds={selectedCats}
              onChange={handleCategoryChange}
            />
          </div>
          <div>
            <p className="font-semibold mb-1 text-sm">Assign to Items</p>
            <ItemMultiSelect
              items={items}
              selectedIds={selectedItems}
              disabledIds={getCatItemIds(selectedCats)}
              onChange={handleItemChange}
            />
          </div>
          {selectedCats.length === 0 && selectedItems.length === 0 && (
            <p className="text-xs text-red-500">This group is not assigned to any items.</p>
          )}
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-teal-600 text-teal-600 rounded hover:bg-teal-50"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
