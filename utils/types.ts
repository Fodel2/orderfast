export interface AddonOption {
  id: string;
  group_id?: string;
  name: string;
  sort_order?: number | null;
  price: number | null;
  available?: boolean | null;
  out_of_stock_until?: string | null;
  stock_status?: string | null;
  stock_return_date?: string | null;
  stock_last_updated_at?: string | null;
}

export interface AddonGroup {
  id: string;
  restaurant_id?: string;
  /**
   * Some queries may return `group_id` instead of `id` for the group
   * identifier (e.g. from `view_addons_for_item`). Include it here so
   * components can reference it when needed.
   */
  group_id?: string;
  name: string;
  sort_order?: number | null;
  required: boolean | null;
  multiple_choice?: boolean | null;
  max_group_select?: number | null;
  max_option_quantity?: number | null;
  addon_options: AddonOption[];
}
