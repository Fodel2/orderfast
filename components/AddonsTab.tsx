import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  TrashIcon,
  PencilSquareIcon,
  DocumentDuplicateIcon,
  PlusCircleIcon,
  LinkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { toast } from './ui/toast';
import { supabase } from '../utils/supabaseClient';
import ConfirmModal from './ConfirmModal';
import AddonGroupModal from './AddonGroupModal';
import AssignAddonGroupModal from './AssignAddonGroupModal';

type AddonOptionRowProps = {
  groupId: string;
  option: any;
  index: number;
  onSave: (gid: string, id: string, fields: any) => void;
  onDelete: (gid: string, id: string) => void;
  dragHandleProps?: { attributes: any; listeners: any };
};

const AddonOptionRow = memo(function AddonOptionRow({
  groupId,
  option,
  index,
  onSave,
  onDelete,
  dragHandleProps,
}: AddonOptionRowProps) {
  const [nameInput, setNameInput] = useState(option?.name || '');
  const [priceDigits, setPriceDigits] = useState(
    typeof option?.price === 'number' ? String(option.price) : String(option?.price ?? 0)
  );

  useEffect(() => {
    setNameInput(option?.name || '');
    setPriceDigits(typeof option?.price === 'number' ? String(option.price) : String(option?.price ?? 0));
  }, [option?.id, option?.name, option?.price]);

  const displayPrice = useMemo(() => {
    const cents = parseInt(priceDigits || '0', 10);
    return Number.isNaN(cents) ? '0.00' : (cents / 100).toFixed(2);
  }, [priceDigits]);

  const handleNameBlur = useCallback(() => {
    const trimmed = nameInput.trim();
    if (trimmed === (option?.name || '')) return;
    onSave(groupId, option.id, { name: trimmed });
  }, [groupId, nameInput, onSave, option?.id, option?.name]);

  const handlePriceBlur = useCallback(() => {
    const cents = parseInt(priceDigits || '0', 10) || 0;
    if (typeof option?.price === 'number' && option.price === cents) return;
    setPriceDigits(String(cents));
    onSave(groupId, option.id, { price: cents });
  }, [groupId, onSave, option?.id, option?.price, priceDigits]);

  return (
    <div className="flex items-end space-x-2 border-b py-1">
      <span
        {...(dragHandleProps?.attributes || {})}
        {...(dragHandleProps?.listeners || {})}
        className="cursor-grab active:cursor-grabbing select-none touch-none text-gray-400"
      >
        ☰
      </span>
      <label className="flex-1 text-sm">
        {index === 0 && <span className="text-xs font-semibold">Addon Name</span>}
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={handleNameBlur}
          className="w-full border border-gray-300 rounded p-1 text-sm"
        />
      </label>
      <label className="w-24 text-sm">
        {index === 0 && <span className="text-xs font-semibold">Price</span>}
        <div className="relative">
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500">£</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={displayPrice}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, '');
              setPriceDigits(digits);
            }}
            onBlur={handlePriceBlur}
            className="w-full border border-gray-300 rounded p-1 pl-4 text-sm appearance-none"
          />
        </div>
      </label>
      <button
        onClick={() => onDelete(groupId, option.id)}
        className="p-1 rounded hover:bg-red-100"
        aria-label="Delete option"
      >
        <TrashIcon className="w-4 h-4 text-red-600" />
      </button>
    </div>
  );
});

type SortableOptionProps = {
  id: string;
  children:
    | React.ReactNode
    | ((args: { attributes: any; listeners: any }) => React.ReactNode);
};

function SortableOption({ id, children }: SortableOptionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    background: isDragging ? '#f0f0f0' : undefined,
  } as React.CSSProperties;
  const renderedChildren =
    typeof children === 'function' ? children({ attributes, listeners }) : children;
  return (
    <div ref={setNodeRef} style={style}>
      {renderedChildren}
    </div>
  );
}

function SortableGroup({
  id,
  children,
}: {
  id: string;
  children: (args: { attributes: any; listeners: any; setNodeRef: any; style: React.CSSProperties }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    background: isDragging ? '#f0f0f0' : undefined,
  } as React.CSSProperties;
  return <>{children({ attributes, listeners, setNodeRef, style })}</>;
}

export default function AddonsTab({ restaurantId }: { restaurantId: number | string }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [groups, setGroups] = useState<any[]>([]);
  const [options, setOptions] = useState<Record<string, any[]>>({});
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [assignModalGroup, setAssignModalGroup] = useState<any | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const restaurantKey = String(restaurantId);

  const ensureDraftsSeeded = useCallback(async () => {
    if (!restaurantKey) return false;
    try {
      const response = await fetch(
        `/api/menu-builder?restaurant_id=${restaurantKey}&withAddons=1&ensureAddonsDrafts=1`
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('[addons-tab:ensure-drafts]', response.status, detail);
        return false;
      }
      const json = await response.json().catch(() => ({}));
      if (json && typeof json === 'object') {
        if (json.addonDraftsSeeded === true) return true;
        if (Array.isArray(json.addonGroups) && json.addonGroups.length > 0) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('[addons-tab:ensure-drafts]', error);
      return false;
    }
  }, [restaurantKey]);

  const load = useCallback(
    async function loadDrafts(retry = false) {
      try {
        const { data: draftGroups, error: draftError } = await supabase
          .from('addon_groups_drafts')
          .select(
            'id,restaurant_id,name,multiple_choice,required,max_group_select,max_option_quantity,archived_at,sort_order,state'
          )
          .eq('restaurant_id', restaurantKey)
          .is('archived_at', null)
          .order('sort_order', { ascending: true, nullsFirst: true })
          .order('id', { ascending: true })
          .order('name', { ascending: true });

        if (draftError) {
          console.error('[addons-tab:load:groups]', draftError.message);
          setGroups([]);
          setOptions({});
          setAssignments({});
          return;
        }

        if (!draftGroups || draftGroups.length === 0) {
          if (!retry) {
            const seeded = await ensureDraftsSeeded();
            if (seeded) {
              await loadDrafts(true);
              return;
            }
          }
          setGroups([]);
          setOptions({});
          setAssignments({});
          return;
        }

        const normalizedGroups = draftGroups.map((group) => ({
          ...group,
          id: String(group.id),
        }));

        const sortedGroups = [...normalizedGroups].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );

        const groupIds = normalizedGroups.map((group) => group.id);
        const { data: draftOptions, error: optionsError } = await supabase
          .from('addon_options_drafts')
          .select(
            'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at,archived_at,sort_order,state'
          )
          .eq('restaurant_id', restaurantKey)
          .in('group_id', groupIds)
          .is('archived_at', null)
          .order('sort_order', { ascending: true, nullsFirst: true })
          .order('id', { ascending: true });

        const optionsMap: Record<string, any[]> = {};
        normalizedGroups.forEach((group) => {
          optionsMap[group.id] = [];
        });

        if (optionsError) {
          console.error('[addons-tab:load:options]', optionsError.message);
        } else {
          (draftOptions || []).forEach((opt) => {
            const groupId = String(opt.group_id);
            const normalizedOption = { ...opt, id: String(opt.id), group_id: groupId };
            if (!optionsMap[groupId]) {
              optionsMap[groupId] = [];
            }
            optionsMap[groupId].push(normalizedOption);
          });
        }

        Object.keys(optionsMap).forEach((gid) => {
          optionsMap[gid] = (optionsMap[gid] || []).sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
          );
        });

        setGroups(sortedGroups);
        setOptions(optionsMap);

        const [{ data: links, error: linksError }, { data: itemsData, error: itemsError }, { data: cats, error: catsError }] =
          await Promise.all([
            supabase
              .from('item_addon_links_drafts')
              .select('group_id,item_external_key,item_id,state')
              .eq('restaurant_id', restaurantKey)
              .is('archived_at', null),
            supabase
              .from('menu_items')
              .select('id,name,category_id,external_key')
              .eq('restaurant_id', restaurantKey)
              .is('archived_at', null)
              .order('sort_order', { ascending: true, nullsFirst: false })
              .order('name', { ascending: true }),
            supabase
              .from('menu_categories')
              .select('id,name')
              .eq('restaurant_id', restaurantKey)
              .is('archived_at', null)
              .order('sort_order', { ascending: true, nullsFirst: false })
              .order('name', { ascending: true }),
          ]);

        if (linksError) {
          console.error('[addons-tab:load:links]', linksError.message);
        }

        if (itemsError) {
          console.error('[addons-tab:load:items]', itemsError.message);
          setAssignments({});
          setItems([]);
          setCategories([]);
          return;
        }

        const normalizedItems = (itemsData || []).map((item) => ({
          ...item,
          id: String(item.id),
          category_id: item.category_id ? String(item.category_id) : null,
          external_key: item.external_key ? String(item.external_key) : null,
        }));

        if (catsError) {
          console.error('[addons-tab:load:categories]', catsError.message);
          setAssignments({});
          setItems(normalizedItems);
          setCategories([]);
          return;
        }

        const normalizedCats = (cats || []).map((cat) => ({ ...cat, id: String(cat.id) }));

        setItems(normalizedItems);
        setCategories(normalizedCats);

        const itemsById = new Map<string, any>();
        normalizedItems.forEach((item) => {
          itemsById.set(item.id, item);
        });

        const assignMap: Record<string, string[]> = {};
        (links || []).forEach((link) => {
          const groupId = link?.group_id ? String(link.group_id) : undefined;
          if (!groupId) return;
          const externalKey = link?.item_external_key
            ? String(link.item_external_key)
            : link?.item_id
            ? itemsById.get(String(link.item_id))?.external_key
            : undefined;
          if (!externalKey) return;
          if (!assignMap[groupId]) assignMap[groupId] = [];
          assignMap[groupId].push(externalKey);
        });

        setAssignments(assignMap);
      } catch (error) {
        console.error('[addons-tab:load:error]', error);
        setGroups([]);
        setOptions({});
        setAssignments({});
        setItems([]);
        setCategories([]);
      }
    },
    [restaurantKey, ensureDraftsSeeded]
  );

  useEffect(() => {
    if (!restaurantKey) return;
    load();
  }, [load, restaurantKey]);

  const sortedGroups = useMemo(
    () =>
      [...groups].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [groups]
  );

  const itemsByExternalKey = useMemo(() => {
    const map = new Map<string, any>();
    items.forEach((item) => {
      if (item?.external_key) {
        map.set(String(item.external_key), item);
      }
    });
    return map;
  }, [items]);

  const modalSelectedItemIds = useMemo(() => {
    if (!assignModalGroup?.id) return [] as string[];
    const assignedKeys = assignments[assignModalGroup.id] || [];
    return assignedKeys
      .map((key) => itemsByExternalKey.get(key))
      .filter(Boolean)
      .map((item: any) => item.id);
  }, [assignModalGroup, assignments, itemsByExternalKey]);

  const assignmentSummaries = useMemo(() => {
    const summaryMap: Record<string, string> = {};
    groups.forEach((group) => {
      const assignedKeys = assignments[group.id] || [];
      const assignedItems = assignedKeys
        .map((key) => itemsByExternalKey.get(key))
        .filter(Boolean) as any[];
      const itemCount = assignedItems.length;
      const categoryCount = new Set(
        assignedItems.map((item) => item.category_id || 'uncategorized')
      ).size;
      summaryMap[group.id] = itemCount
        ? `Assigned: ${categoryCount} categories · ${itemCount} items`
        : 'Not assigned';
    });
    return summaryMap;
  }, [assignments, groups, itemsByExternalKey]);

  const handleAssignmentsSaved = (groupId: string, itemIds: string[], externalKeyMap: Record<string, string>) => {
    const keyByItemId: Record<string, string> = {};
    items.forEach((item) => {
      if (item?.id && item?.external_key) {
        keyByItemId[String(item.id)] = String(item.external_key);
      }
    });
    Object.entries(externalKeyMap || {}).forEach(([itemId, key]) => {
      keyByItemId[itemId] = key;
    });

    const updatedKeys = itemIds.map((id) => keyByItemId[id]).filter(Boolean) as string[];

    setItems((prev) =>
      prev.map((item) => {
        const newKey = externalKeyMap[item.id];
        return newKey ? { ...item, external_key: newKey } : item;
      })
    );

    setAssignments((prev) => ({ ...prev, [groupId]: updatedKeys }));
  };

  const addOption = async (gid: string) => {
    const { data, error } = await supabase
      .from('addon_options_drafts')
      .insert([
        {
          restaurant_id: restaurantKey,
          group_id: gid,
          name: '',
          price: 0,
          available: true,
          archived_at: null,
          state: 'draft',
          sort_order: (options[gid]?.length ?? 0),
        },
      ])
      .select(
        'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at,sort_order'
      )
      .single();

    if (error) {
      console.error('[addons-tab:add-option]', error.message);
      return;
    }

    if (data) {
      const optionId = String(data.id);
      const groupId = String(data.group_id ?? gid);
      const normalized = { ...data, id: optionId, group_id: groupId };
      setOptions((prev) => {
        const next = [...(prev[groupId] || []), normalized].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );
        return { ...prev, [groupId]: next };
      });
    }
  };

  const updateOption = async (gid: string, id: string, fields: any) => {
    const { error } = await supabase
      .from('addon_options_drafts')
      .update(fields)
      .eq('id', id)
      .eq('restaurant_id', restaurantKey);

    if (error) {
      console.error('[addons-tab:update-option]', error.message);
      return;
    }

    setOptions((prev) => ({
      ...prev,
      [gid]: (prev[gid] || []).map((o) => (o.id === id ? { ...o, ...fields } : o)),
    }));
  };

  const deleteOption = async (gid: string, id: string) => {
    const { error } = await supabase
      .from('addon_options_drafts')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantKey);

    if (error) {
      console.error('[addons-tab:delete-option]', error.message);
      return;
    }

    setOptions((prev) => ({ ...prev, [gid]: (prev[gid] || []).filter((o) => o.id !== id) }));
  };

  const persistOptionOrder = useCallback(
    async (gid: string, opts: any[], previous: any[]) => {
      const updates = opts.map((opt, idx) => ({ id: opt.id, sort_order: idx }));
      const firstError = (
        await Promise.all(
          updates.map((row) =>
            supabase
              .from('addon_options_drafts')
              .update({ sort_order: row.sort_order })
              .eq('id', row.id)
              .eq('restaurant_id', restaurantKey)
          )
        )
      ).find((res) => res.error)?.error;

      if (firstError) {
        console.error('[addons-tab:option-order]', firstError.message);
        setOptions((prev) => ({ ...prev, [gid]: previous }));
        toast.error('Could not save add-on item order');
      }
    },
    [restaurantKey]
  );

  const persistGroupOrder = useCallback(
    async (orderedGroups: any[], previous: any[]) => {
      const updates = orderedGroups.map((group, idx) => ({ id: group.id, sort_order: idx }));
      const firstError = (
        await Promise.all(
          updates.map((row) =>
            supabase
              .from('addon_groups_drafts')
              .update({ sort_order: row.sort_order })
              .eq('id', row.id)
              .eq('restaurant_id', restaurantKey)
          )
        )
      ).find((res) => res.error)?.error;

      if (firstError) {
        console.error('[addons-tab:group-order]', firstError.message);
        setGroups(previous);
        toast.error('Could not save category order');
      }
    },
    [restaurantKey]
  );

  const handleGroupDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setGroups((prev) => {
      const oldIndex = prev.findIndex((g) => g.id === active.id);
      const newIndex = prev.findIndex((g) => g.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex).map((g, idx) => ({
        ...g,
        sort_order: idx,
      }));
      persistGroupOrder(reordered, prev);
      return reordered;
    });
  };

  const handleDragEnd = (gid: string) => ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOptions((prev) => {
      const arr = (prev[gid] || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const oldIndex = arr.findIndex((o) => o.id === active.id);
      const newIndex = arr.findIndex((o) => o.id === over.id);
      const reordered = arrayMove(arr, oldIndex, newIndex).map((opt, idx) => ({
        ...opt,
        sort_order: idx,
      }));
      persistOptionOrder(gid, reordered, arr);
      return { ...prev, [gid]: reordered };
    });
  };

  const toggleCollapse = useCallback((gid: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) {
        next.delete(gid);
      } else {
        next.add(gid);
      }
      return next;
    });
  }, []);

  const duplicateGroup = async (g: any) => {
    const { data: newGroup } = await supabase
      .from('addon_groups_drafts')
      .insert([
        {
          name: `${g.name} - copy`,
          multiple_choice: g.multiple_choice,
          required: g.required,
          restaurant_id: restaurantKey,
          max_group_select: g.max_group_select,
          max_option_quantity: g.max_option_quantity,
          archived_at: null,
          state: 'draft',
        },
      ])
      .select()
      .single();
    if (newGroup) {
      const newGroupId = String(newGroup.id);
      const groupOpts = options[String(g.id)] || [];
      if (groupOpts.length) {
        await supabase.from('addon_options_drafts').insert(
          groupOpts.map((o, idx) => ({
            name: o.name,
            price: o.price,
            available: o.available,
            group_id: newGroupId,
            out_of_stock_until: o.out_of_stock_until,
            stock_status: o.stock_status,
            stock_return_date: o.stock_return_date,
            stock_last_updated_at: o.stock_last_updated_at,
            restaurant_id: restaurantKey,
            archived_at: null,
            state: 'draft',
            sort_order: idx,
          }))
        );
      }
      load();
    }
  };

  const deleteGroup = async (g: any) => {
    await supabase.from('addon_options_drafts').delete().eq('group_id', g.id).eq('restaurant_id', restaurantKey);
    await supabase
      .from('item_addon_links_drafts')
      .delete()
      .eq('group_id', g.id)
      .eq('restaurant_id', restaurantKey);
    await supabase.from('addon_groups_drafts').delete().eq('id', g.id).eq('restaurant_id', restaurantKey);
    load();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span>🔧</span> Add-On Manager
        </h2>
        <p className="text-gray-500 text-sm">
          Create extra options like toppings, dips, and upgrades that customers can choose before adding their food to the cart.
        </p>
      </div>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Add-on Categories</h2>
        <button
          onClick={() => {
            setEditingGroup(null);
            setShowModal(true);
          }}
          className="flex items-center bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700"
        >
          <PlusCircleIcon className="w-5 h-5 mr-1" /> Add Category
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
        <SortableContext items={sortedGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          {sortedGroups.map((g) => (
            <SortableGroup key={g.id} id={g.id}>
              {({ attributes, listeners, setNodeRef, style }) => (
                <div ref={setNodeRef} style={style} className="bg-white rounded-xl shadow mb-4">
                  <div className="flex justify-between p-4 select-none">
                    <div className="flex items-start space-x-3">
                      <span
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing select-none touch-none text-gray-400"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        ☰
                      </span>
                      <div className="space-y-1">
                        <h3 className="font-semibold flex items-center gap-1">
                          <span>{g.name || 'Untitled Category'}</span>
                        </h3>
                        <p className="text-xs text-gray-500">
                          {g.multiple_choice ? 'Multiple Choice' : 'Single Choice'}
                          {g.required ? ' · Required' : ''}
                        </p>
                        <p className="text-[11px] font-medium text-gray-600">{assignmentSummaries[g.id] || 'Not assigned'}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2 items-start" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleCollapse(g.id)}
                        className="p-2 rounded hover:bg-gray-100"
                        aria-label={collapsedGroups.has(g.id) ? 'Expand category' : 'Collapse category'}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {collapsedGroups.has(g.id) ? (
                          <ChevronDownIcon className="w-5 h-5" />
                        ) : (
                          <ChevronUpIcon className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => setAssignModalGroup(g)}
                        className="p-2 rounded hover:bg-gray-100"
                        aria-label="Assign add-ons"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <LinkIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingGroup(g);
                          setShowModal(true);
                        }}
                        className="p-2 rounded hover:bg-gray-100"
                        aria-label="Edit"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => duplicateGroup(g)}
                        className="p-2 rounded hover:bg-gray-100"
                        aria-label="Duplicate"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <DocumentDuplicateIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setConfirmDel(g)}
                        className="p-2 rounded hover:bg-gray-100"
                        aria-label="Delete"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  {!collapsedGroups.has(g.id) && (
                    <div className="p-4 pt-0">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(g.id)}>
                        <SortableContext items={(options[g.id] || []).map((o) => o.id)} strategy={verticalListSortingStrategy}>
                          {(options[g.id] || []).map((o, idx) => (
                            <SortableOption key={o.id} id={o.id}>
                              {({ attributes: optAttr, listeners: optListeners }) => (
                                <AddonOptionRow
                                  groupId={g.id}
                                  option={o}
                                  index={idx}
                                  onSave={updateOption}
                                  onDelete={deleteOption}
                                  dragHandleProps={{ attributes: optAttr, listeners: optListeners }}
                                />
                              )}
                            </SortableOption>
                          ))}
                        </SortableContext>
                      </DndContext>
                      <button onClick={() => addOption(g.id)} className="mt-2 flex items-center text-sm text-teal-600 hover:underline">
                        <PlusCircleIcon className="w-4 h-4 mr-1" /> Add Item
                      </button>
                    </div>
                  )}
                </div>
              )}
            </SortableGroup>
          ))}
        </SortableContext>
      </DndContext>
      {showModal && (
        <AddonGroupModal
          show={showModal}
          restaurantId={restaurantId}
          group={editingGroup || undefined}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
      {assignModalGroup && (
        <AssignAddonGroupModal
          show={!!assignModalGroup}
          restaurantId={restaurantKey}
          groupId={String(assignModalGroup.id)}
          categories={categories}
          items={items}
          initialSelectedItemIds={modalSelectedItemIds}
          onClose={() => setAssignModalGroup(null)}
          onSaved={(itemIds, externalKeyMap) => {
            handleAssignmentsSaved(String(assignModalGroup.id), itemIds, externalKeyMap);
            setAssignModalGroup(null);
          }}
        />
      )}
      {confirmDel && (
        <ConfirmModal
          show={true}
          title="Delete category?"
          message="This will remove all addon items and assignments."
          onConfirm={() => {
            deleteGroup(confirmDel);
            setConfirmDel(null);
          }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
