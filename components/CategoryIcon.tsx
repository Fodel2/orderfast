import { LucideIcon, CupSoda, Drumstick, Pizza, Dessert, Sandwich, Salad } from "lucide-react";

const mappings: [string, LucideIcon][] = [
  ["burger", Drumstick],
  ["drink", CupSoda],
  ["beverage", CupSoda],
  ["pizza", Pizza],
  ["dessert", Dessert],
  ["sweet", Dessert],
  ["sandwich", Sandwich],
  ["salad", Salad],
];

export default function CategoryIcon({ category }: { category: string }) {
  const lower = category.toLowerCase();
  const found = mappings.find(([key]) => lower.includes(key));
  if (!found) return null;
  const Icon = found[1];
  return <Icon className="w-6 h-6" />;
}
