type AssignmentItem = {
  id: string;
  external_key?: string | null;
};

export async function updateAddonGroupAssignments({
  restaurantId,
  groupId,
  items,
}: {
  restaurantId: string;
  groupId: string;
  items: AssignmentItem[];
}) {
  if (!restaurantId || !groupId) {
    throw new Error('Missing restaurantId or groupId for assignment save');
  }

  const uniqueItems = Array.from(new Map(items.map((item) => [String(item.id), item])).values());
  const response = await fetch('/api/menu-builder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurantId,
      action: 'assign_addon_group',
      groupId,
      items: uniqueItems,
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = json?.message || json?.error || 'Failed to save assignments';
    throw new Error(msg);
  }

  return { externalKeyMap: json?.externalKeyMap || {} };
}
