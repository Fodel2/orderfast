import { useEffect, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TrashIcon, PencilSquareIcon, DocumentDuplicateIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { supabase } from '../utils/supabaseClient';
import ConfirmModal from './ConfirmModal';
import AddonGroupModal from './AddonGroupModal';

function SortableOption({ id, children }: { id: number; children: React.ReactNode }) {
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

export default function AddonsTab({ restaurantId }: { restaurantId: number }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [groups, setGroups] = useState<any[]>([]);
  const [options, setOptions] = useState<Record<number, any[]>>({});
  const [priceInputs, setPriceInputs] = useState<Record<number, string>>({});
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<Record<number, string[]>>({});

  const load = async () => {
    const { data: grp } = await supabase
      .from('addon_groups')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('id');
    setGroups(grp || []);
    if (grp && grp.length) {
      const { data: opts } = await supabase
        .from('addon_options')
        .select('*')
        .in('group_id', grp.map((g) => g.id));
      const map: Record<number, any[]> = {};
      const priceMap: Record<number, string> = {};
      grp.forEach((g) => (map[g.id] = []));
      opts?.forEach((o) => {
        if (!map[o.group_id]) map[o.group_id] = [];
        map[o.group_id].push(o);
        priceMap[o.id] = String(o.price ?? 0);
      });
      setOptions(map);
      setPriceInputs(priceMap);

      // Fetch item assignments for display
      const { data: links } = await supabase
        .from('item_addon_links')
        .select('group_id,item_id');
      const { data: items } = await supabase
        .from('menu_items')
        .select('id,name,category_id')
        .eq('restaurant_id', restaurantId)
        .order('archived_at', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });
      const { data: cats } = await supabase
        .from('menu_categories')
        .select('id,name')
        .eq('restaurant_id', restaurantId)
        .order('archived_at', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      const itemMap = new Map<number, { name: string; category_id: number | null }>();
      items?.forEach((it) => {
        itemMap.set(Number(it.id), { name: it.name, category_id: it.category_id });
      });
      const catMap = new Map<number, string>();
      cats?.forEach((c) => catMap.set(Number(c.id), c.name));
      const assignMap: Record<number, string[]> = {};
      links?.forEach((l) => {
        const gId = Number(l.group_id);
        const item = itemMap.get(Number(l.item_id));
        if (!item) return;
        const catName = item.category_id ? catMap.get(Number(item.category_id)) : undefined;
        const label = catName ? `${catName} - ${item.name}` : item.name;
        if (!assignMap[gId]) assignMap[gId] = [];
        assignMap[gId].push(label);
      });
      setAssignments(assignMap);
    } else {
      setOptions({});
      setPriceInputs({});
      setAssignments({});
    }
  };

  useEffect(() => {
    load();
  }, [restaurantId]);

  const addOption = async (gid: number) => {
    const { data } = await supabase
      .from('addon_options')
      .insert([{ name: '', price: 0, available: true, group_id: gid }])
      .select()
      .single();
    if (data) {
      setOptions((prev) => ({ ...prev, [gid]: [...(prev[gid] || []), data] }));
      setPriceInputs((prev) => ({ ...prev, [data.id]: '0' }));
    }
  };

  const updateOption = async (gid: number, id: number, fields: any) => {
    await supabase.from('addon_options').update(fields).eq('id', id);
    setOptions((prev) => ({
      ...prev,
      [gid]: prev[gid].map((o) => (o.id === id ? { ...o, ...fields } : o)),
    }));
    if (fields.price !== undefined) {
      setPriceInputs((p) => ({ ...p, [id]: String(fields.price) }));
    }
  };

  const deleteOption = async (gid: number, id: number) => {
    await supabase.from('addon_options').delete().eq('id', id);
    setOptions((prev) => ({ ...prev, [gid]: prev[gid].filter((o) => o.id !== id) }));
    setPriceInputs((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleDragEnd = (gid: number) => ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOptions((prev) => {
      const arr = prev[gid];
      const oldIndex = arr.findIndex((o) => o.id === active.id);
      const newIndex = arr.findIndex((o) => o.id === over.id);
      return { ...prev, [gid]: arrayMove(arr, oldIndex, newIndex) };
    });
  };

  const duplicateGroup = async (g: any) => {
    const { data: newGroup } = await supabase
      .from('addon_groups')
      .insert([
        {
          name: `${g.name} - copy`,
          multiple_choice: g.multiple_choice,
          required: g.required,
          restaurant_id: restaurantId,
          max_group_select: g.max_group_select,
          max_option_quantity: g.max_option_quantity,
        },
      ])
      .select()
      .single();
    if (newGroup) {
      const groupOpts = options[g.id] || [];
      if (groupOpts.length) {
        await supabase.from('addon_options').insert(
          groupOpts.map((o) => ({ name: o.name, price: o.price, available: o.available, group_id: newGroup.id }))
        );
      }
      load();
    }
  };

  const deleteGroup = async (g: any) => {
    await supabase.from('addon_options').delete().eq('group_id', g.id);
    await supabase.from('item_addon_links').delete().eq('group_id', g.id);
    await supabase.from('addon_groups').delete().eq('id', g.id);
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
