export const ADDON_OPTION_FIELDS = [
  'id',
  'group_id',
  'name',
  'price',
  'available',
  'out_of_stock_until',
  'stock_status',
  'stock_return_date',
  'stock_last_updated_at',
  'archived_at',
].join(',');

export const ADDON_GROUP_FIELDS = [
  'id',
  'restaurant_id',
  'name',
  'required',
  'multiple_choice',
  'max_group_select',
  'max_option_quantity',
  'archived_at',
].join(',');

export const ADDON_GROUP_WITH_OPTIONS_FIELDS = `${ADDON_GROUP_FIELDS},addon_options(${ADDON_OPTION_FIELDS})`;

export const ADDON_GROUP_WITH_OPTIONS_INNER_FIELDS = `${ADDON_GROUP_FIELDS},addon_options!inner(${ADDON_OPTION_FIELDS})`;

export const ITEM_ADDON_LINK_WITH_GROUPS_SELECT = `id,item_id,group_id,addon_groups!inner(${ADDON_GROUP_WITH_OPTIONS_INNER_FIELDS})`;

export const ITEM_ADDON_LINK_WITH_GROUPS_AND_ITEMS_SELECT = `${ITEM_ADDON_LINK_WITH_GROUPS_SELECT},menu_items!inner(id,restaurant_id)`;
