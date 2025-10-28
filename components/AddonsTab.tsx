import { useCallback, useEffect, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TrashIcon, PencilSquareIcon, DocumentDuplicateIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { supabase } from '../utils/supabaseClient';
import ConfirmModal from './ConfirmModal';
import AddonGroupModal from './AddonGroupModal';

function SortableOption({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    background: isDragging ? '#f0f0f0' : undefined,
    cursor: 'grab',
  } as React.CSSProperties;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function AddonsTab({ restaurantId }: { restaurantId: number | string }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [groups, setGroups] = useState<any[]>([]);
  const [options, setOptions] = useState<Record<string, any[]>>({});
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});

  const restaurantKey = String(restaurantId);

  const seedDraftsFromLive = useCallback(async () => {
    try {
      const { data: liveGroups, error: liveGroupsError } = await supabase
        .from('addon_groups')
        .select(
          'id,name,multiple_choice,required,max_group_select,max_option_quantity,archived_at'
        )
        .eq('restaurant_id', restaurantKey)
        .is('archived_at', null)
        .order('id', { ascending: true })
        .order('name', { ascending: true });

      if (liveGroupsError) {
        console.error('[addons-tab:seed:groups]', liveGroupsError.message);
        return false;
      }

      if (!liveGroups || liveGroups.length === 0) {
        return false;
      }

      const liveGroupIds = liveGroups.map((g) => g.id);

      const { data: liveOptions, error: liveOptionsError } = await supabase
        .from('addon_options')
        .select(
          'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at,archived_at'
        )
        .eq('restaurant_id', restaurantKey)
        .in('group_id', liveGroupIds)
        .is('archived_at', null);

      if (liveOptionsError) {
        console.error('[addons-tab:seed:options]', liveOptionsError.message);
        return false;
      }

      const insertGroupsPayload = liveGroups.map((group) => ({
        restaurant_id: restaurantKey,
        name: group.name,
        multiple_choice: group.multiple_choice,
        required: group.required,
        max_group_select: group.max_group_select,
        max_option_quantity: group.max_option_quantity,
        archived_at: null,
        state: 'draft',
      }));

      const { data: insertedGroups, error: insertGroupsError } = await supabase
        .from('addon_groups_drafts')
        .insert(insertGroupsPayload)
        .select('id');

      if (insertGroupsError) {
        console.error('[addons-tab:seed:insert-groups]', insertGroupsError.message);
        return false;
      }

      if (!insertedGroups) {
        return false;
      }

      const liveToDraftGroup = new Map<string, string>();
      liveGroups.forEach((group, index) => {
        const inserted = insertedGroups[index];
        if (inserted?.id) {
          liveToDraftGroup.set(String(group.id), String(inserted.id));
        }
      });

      const optionPayload: any[] = [];
      (liveOptions || []).forEach((opt) => {
        const mappedGroupId = liveToDraftGroup.get(String(opt.group_id));
        if (!mappedGroupId) return;
        optionPayload.push({
          restaurant_id: restaurantKey,
          group_id: mappedGroupId,
          name: opt.name,
          price: opt.price,
          available: opt.available,
          out_of_stock_until: opt.out_of_stock_until,
          stock_status: opt.stock_status,
          stock_return_date: opt.stock_return_date,
          stock_last_updated_at: opt.stock_last_updated_at,
          archived_at: null,
          state: 'draft',
        });
      });

      if (optionPayload.length > 0) {
        const { error: insertOptionsError } = await supabase
          .from('addon_options_drafts')
          .insert(optionPayload);

        if (insertOptionsError) {
          console.error('[addons-tab:seed:insert-options]', insertOptionsError.message);
        }
      }

      const { data: liveLinks, error: liveLinksError } = await supabase
        .from('item_addon_links')
        .select('group_id,item_id')
        .eq('restaurant_id', restaurantKey);

      if (!liveLinksError && liveLinks && liveLinks.length > 0) {
        const itemIds = Array.from(new Set(liveLinks.map((link) => String(link.item_id))));
        const { data: items, error: itemsError } = await supabase
          .from('menu_items')
          .select('id,external_key,restaurant_id')
          .in('id', itemIds)
          .eq('restaurant_id', restaurantKey);

        if (itemsError) {
          console.error('[addons-tab:seed:items]', itemsError.message);
        } else {
          const idToExternalKey = new Map<string, string>();
          (items || []).forEach((item) => {
            if (item?.id && item?.external_key) {
              idToExternalKey.set(String(item.id), String(item.external_key));
            }
          });

          const linkPayload: Array<{ restaurant_id: string; item_external_key: string; group_id_draft: string }> = [];
          const seen = new Set<string>();
          liveLinks.forEach((link) => {
            const draftGroupId = liveToDraftGroup.get(String(link.group_id));
            const externalKey = idToExternalKey.get(String(link.item_id));
            if (!draftGroupId || !externalKey) return;
            const dedupe = `${externalKey}:${draftGroupId}`;
            if (seen.has(dedupe)) return;
            seen.add(dedupe);
            linkPayload.push({
              restaurant_id: restaurantKey,
              item_external_key: externalKey,
              group_id_draft: draftGroupId,
            });
          });

          if (linkPayload.length > 0) {
            const { error: insertLinksError } = await supabase
              .from('item_addon_links_drafts')
              .insert(linkPayload);

            if (insertLinksError) {
              console.error('[addons-tab:seed:insert-links]', insertLinksError.message);
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error('[addons-tab:seed:error]', error);
      return false;
    }
  }, [restaurantKey]);

  const load = useCallback(async () => {
    try {
      const { data: draftGroups, error: draftError } = await supabase
        .from('addon_groups_drafts')
        .select(
          'id,restaurant_id,name,multiple_choice,required,max_group_select,max_option_quantity,archived_at,state'
        )
        .eq('restaurant_id', restaurantKey)
        .eq('state', 'draft')
        .is('archived_at', null)
        .order('id', { ascending: true })
        .order('name', { ascending: true });

      if (draftError) {
        console.error('[addons-tab:load:groups]', draftError.message);
        setGroups([]);
        setOptions({});
        setPriceInputs({});
        setAssignments({});
        return;
      }

      if (!draftGroups || draftGroups.length === 0) {
        const seeded = await seedDraftsFromLive();
        if (seeded) {
          await load();
          return;
        }
        setGroups([]);
        setOptions({});
        setPriceInputs({});
        setAssignments({});
        return;
      }

      const normalizedGroups = draftGroups.map((group) => ({
        ...group,
        id: String(group.id),
      }));

      setGroups(normalizedGroups);

      const groupIds = normalizedGroups.map((group) => group.id);
      const { data: draftOptions, error: optionsError } = await supabase
        .from('addon_options_drafts')
        .select(
          'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at,archived_at,state'
        )
        .eq('restaurant_id', restaurantKey)
        .in('group_id', groupIds)
        .eq('state', 'draft')
        .is('archived_at', null);

      const optionsMap: Record<string, any[]> = {};
      const priceMap: Record<string, string> = {};
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
          priceMap[String(opt.id)] = String(opt.price ?? 0);
        });
      }

      setOptions(optionsMap);
      setPriceInputs(priceMap);

      const { data: links, error: linksError } = await supabase
        .from('item_addon_links_drafts')
        .select('group_id_draft,item_external_key')
        .eq('restaurant_id', restaurantKey);

      if (linksError) {
        console.error('[addons-tab:load:links]', linksError.message);
        setAssignments({});
        return;
      }

      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select('id,name,category_id,external_key')
        .eq('restaurant_id', restaurantKey)
        .order('archived_at', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (itemsError) {
        console.error('[addons-tab:load:items]', itemsError.message);
        setAssignments({});
        return;
      }

      const { data: cats, error: catsError } = await supabase
        .from('menu_categories')
        .select('id,name')
        .eq('restaurant_id', restaurantKey)
        .order('archived_at', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (catsError) {
        console.error('[addons-tab:load:categories]', catsError.message);
        setAssignments({});
        return;
      }

      const externalToItem = new Map<string, { name: string; category_id: string | null }>();
      (items || []).forEach((item) => {
        if (!item?.external_key) return;
        externalToItem.set(String(item.external_key), {
          name: item.name,
          category_id: item.category_id ? String(item.category_id) : null,
        });
      });

      const catMap = new Map<string, string>();
      (cats || []).forEach((cat) => {
        if (!cat?.id) return;
        catMap.set(String(cat.id), cat.name);
      });

      const assignMap: Record<string, string[]> = {};
      (links || []).forEach((link) => {
        const groupId = String(link.group_id_draft);
        const item = link.item_external_key ? externalToItem.get(String(link.item_external_key)) : undefined;
        if (!item) return;
        const catName = item.category_id ? catMap.get(item.category_id) : undefined;
        const label = catName ? `${catName} - ${item.name}` : item.name;
        if (!assignMap[groupId]) assignMap[groupId] = [];
        assignMap[groupId].push(label);
      });

      setAssignments(assignMap);
    } catch (error) {
      console.error('[addons-tab:load:error]', error);
      setGroups([]);
      setOptions({});
      setPriceInputs({});
      setAssignments({});
    }
  }, [restaurantKey, seedDraftsFromLive]);

  useEffect(() => {
    if (!restaurantKey) return;
    load();
  }, [load, restaurantKey]);

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
        },
      ])
      .select(
        'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at'
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
      setOptions((prev) => ({ ...prev, [groupId]: [...(prev[groupId] || []), normalized] }));
      setPriceInputs((prev) => ({ ...prev, [optionId]: '0' }));
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
    if (fields.price !== undefined) {
      setPriceInputs((p) => ({ ...p, [id]: String(fields.price) }));
    }
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
    setPriceInputs((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleDragEnd = (gid: string) => ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOptions((prev) => {
      const arr = prev[gid] || [];
      const oldIndex = arr.findIndex((o) => o.id === active.id);
      const newIndex = arr.findIndex((o) => o.id === over.id);
      return { ...prev, [gid]: arrayMove(arr, oldIndex, newIndex) };
    });
  };

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
          groupOpts.map((o) => ({
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
      .eq('group_id_draft', g.id)
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
      {groups.map((g) => (
        <div key={g.id} className="bg-white rounded-xl shadow mb-4">
          <div className="flex justify-between p-4">
            <div>
              <h3 className="font-semibold">{g.name}</h3>
              <p className="text-xs text-gray-500">
                {g.multiple_choice ? 'Multiple Choice' : 'Single Choice'}
                {g.required ? ' · Required' : ''}
              </p>
              {assignments[g.id]?.length ? (
                <p className="text-[11px] text-gray-500 mt-1">
                  Attached to: {assignments[g.id].join(', ')}
                </p>
              ) : null}
            </div>
            <div className="flex space-x-2">
              <button onClick={() => { setEditingGroup(g); setShowModal(true); }} className="p-2 rounded hover:bg-gray-100" aria-label="Edit">
                <PencilSquareIcon className="w-5 h-5" />
              </button>
              <button onClick={() => duplicateGroup(g)} className="p-2 rounded hover:bg-gray-100" aria-label="Duplicate">
                <DocumentDuplicateIcon className="w-5 h-5" />
              </button>
              <button onClick={() => setConfirmDel(g)} className="p-2 rounded hover:bg-gray-100" aria-label="Delete">
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-4 pt-0">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(g.id)}>
              <SortableContext items={(options[g.id] || []).map((o) => o.id)} strategy={verticalListSortingStrategy}>
                {(options[g.id] || []).map((o, idx) => (
                  <SortableOption key={o.id} id={o.id}>
                    <div className="flex items-end space-x-2 border-b py-1">
                      <label className="flex-1 text-sm">
                        {idx === 0 && (
                          <span className="text-xs font-semibold">Addon Name</span>
                        )}
                        <input
                          type="text"
                          value={o.name}
                          onChange={(e) =>
                            updateOption(g.id, o.id, { name: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded p-1 text-sm"
                        />
                      </label>
                      <label className="w-24 text-sm">
                        {idx === 0 && (
                          <span className="text-xs font-semibold">Price</span>
                        )}
                        <div className="relative">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500">
                            $
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={(
                              parseInt(priceInputs[o.id] ?? String(o.price ?? 0), 10) /
                              100
                            ).toFixed(2)}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/[^0-9]/g, '');
                              updateOption(g.id, o.id, { price: parseInt(digits || '0', 10) });
                              setPriceInputs((prev) => ({ ...prev, [o.id]: digits }));
                            }}
                            className="w-full border border-gray-300 rounded p-1 pl-4 text-sm appearance-none"
                          />
                        </div>
                      </label>
                      <button
                        onClick={() => deleteOption(g.id, o.id)}
                        className="p-1 rounded hover:bg-red-100"
                        aria-label="Delete option"
                      >
                        <TrashIcon className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </SortableOption>
                ))}
              </SortableContext>
            </DndContext>
            <button onClick={() => addOption(g.id)} className="mt-2 flex items-center text-sm text-teal-600 hover:underline">
              <PlusCircleIcon className="w-4 h-4 mr-1" /> Add Item
            </button>
          </div>
        </div>
      ))}
      {showModal && (
        <AddonGroupModal
          show={showModal}
          restaurantId={restaurantId}
          group={editingGroup || undefined}
          onClose={() => setShowModal(false)}
          onSaved={load}
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
