export interface AddonOption {
  id: string;
  name: string;
  price: number | null;
  image_url?: string | null;
  is_vegetarian?: boolean | null;
  is_vegan?: boolean | null;
  is_18_plus?: boolean | null;
}

export interface AddonGroup {
  id: string;
  /**
   * Some queries may return `group_id` instead of `id` for the group
   * identifier (e.g. from `view_addons_for_item`). Include it here so
   * components can reference it when needed.
   */
  group_id?: string;
  name: string;
  required: boolean | null;
  multiple_choice?: boolean | null;
  max_group_select?: number | null;
  max_option_quantity?: number | null;
  addon_options: AddonOption[];
}

