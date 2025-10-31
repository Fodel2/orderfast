import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

interface AddonGroupModalProps {
  show: boolean;
  restaurantId: number | string;
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

  useEffect(() => {
    if (!show) return;
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
    } else {
      setName('');
      setMultipleChoice(false);
      setRequired(false);
      setMaxGroupSelect('');
      setMaxOptionQuantity('');
    }
  }, [show, group]);

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

    const restaurantKey = String(restaurantId);

    if (group) {
      const { error } = await supabase
        .from('addon_groups_drafts')
        .update({
          name,
          multiple_choice: multipleChoice,
          required,
          max_group_select: parsedMaxGroup,
          max_option_quantity: parsedMaxOption,
        })
        .eq('id', group.id)
        .eq('restaurant_id', restaurantKey)
        .eq('state', 'draft');
      if (error) {
        alert('Failed to save: ' + error.message);
        return;
      }
    } else {
      const payload = {
        name,
        multiple_choice: multipleChoice,
        required,
        restaurant_id: restaurantKey,
        max_group_select: parsedMaxGroup,
        max_option_quantity: parsedMaxOption,
        archived_at: null,
        state: 'draft',
      };

      const { data, error: insertError } = await supabase
        .from('addon_groups_drafts')
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
