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
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);

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
      grp.forEach((g) => (map[g.id] = []));
      opts?.forEach((o) => {
        if (!map[o.group_id]) map[o.group_id] = [];
        map[o.group_id].push(o);
      });
      setOptions(map);
    } else {
      setOptions({});
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
    }
  };

  const updateOption = async (gid: number, id: number, fields: any) => {
    await supabase.from('addon_options').update(fields).eq('id', id);
    setOptions((prev) => ({
      ...prev,
      [gid]: prev[gid].map((o) => (o.id === id ? { ...o, ...fields } : o)),
    }));
  };

  const deleteOption = async (gid: number, id: number) => {
    await supabase.from('addon_options').delete().eq('id', id);
    setOptions((prev) => ({ ...prev, [gid]: prev[gid].filter((o) => o.id !== id) }));
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
      .insert([{ name: `${g.name} - copy`, multiple_choice: g.multiple_choice, required: g.required, restaurant_id: restaurantId }])
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
    await supabase.from('menu_item_addon_groups').delete().eq('addon_group_id', g.id);
    await supabase.from('addon_groups').delete().eq('id', g.id);
    load();
  };

  return (
    <div>
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
                {(options[g.id] || []).map((o) => (
                  <SortableOption key={o.id} id={o.id}>
                    <div className="flex items-center space-x-2 border-b py-1">
                      <input
                        type="text"
                        value={o.name}
                        onChange={(e) => updateOption(g.id, o.id, { name: e.target.value })}
                        className="flex-1 border border-gray-300 rounded p-1 text-sm"
                      />
                      <input
                        type="number"
                        value={o.price}
                        onChange={(e) => updateOption(g.id, o.id, { price: parseFloat(e.target.value) || 0 })}
                        className="w-20 border border-gray-300 rounded p-1 text-sm"
                      />
                      <button onClick={() => deleteOption(g.id, o.id)} className="p-1 rounded hover:bg-red-100" aria-label="Delete option">
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
