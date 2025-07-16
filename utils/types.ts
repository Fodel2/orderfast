export interface AddonOption {
  id: string;
  name: string;
  price: number | null;
}

export interface AddonGroup {
  id: string;
  name: string;
  required: boolean | null;
  multiple_choice?: boolean | null;
  addon_options: AddonOption[];
}
