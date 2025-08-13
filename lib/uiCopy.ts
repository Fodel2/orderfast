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

export const cancelledQuips = [
  "This one’s been cancelled — sorry about that.",
  "We’re sorry — your order was cancelled. We’ll make it right.",
  "Order cancelled. Thanks for your patience and understanding.",
  "This plate won’t be served today — our apologies.",
  "Cancelled — sorry for the hassle. Hope to see you again soon."
];
export function randomCancelledMessage() {
  return cancelledQuips[Math.floor(Math.random() * cancelledQuips.length)];
}
