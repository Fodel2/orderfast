export const plateQuips = [
  "Your plate is empty — let’s fix that.",
  "Nothing on the plate… yet.",
  "This plate’s looking a bit hungry.",
  "Empty plate, full possibilities.",
  "Let’s put something tasty on that plate.",
  "Plate status: spotless. Add food!",
  "Your plate called. It wants snacks.",
  "So clean you can see your reflection.",
  "Chef’s waiting. What’s first?",
  "Add a dish to start your feast."
];
export function randomEmptyPlateMessage() {
  return plateQuips[Math.floor(Math.random() * plateQuips.length)];
}
