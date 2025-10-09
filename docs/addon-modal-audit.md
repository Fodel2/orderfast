# Add-on Modal Audit

This document captures the commits that materially affected the customer add-on modal implementation. Dates use the repository timezone.

## Key commits touching the modal or add-on selection

| Commit | Date | Files | Summary |
| --- | --- | --- | --- |
| 43b0181 | 2025-08-13 | `components/MenuItemCard.tsx`, `components/AddonGroups.tsx`, `components/AddonGroupModal.tsx` | First shipping of the customer add-on modal. Menu item cards opened a centred dialog that fetched add-on groups on demand, collected notes/quantity, and validated selections before calling `addToCart`. Added the reusable `AddonGroups` list and modal helpers. |
| c7b6ee1 | 2025-08-14 | `components/MenuItemCard.tsx` | Replaced the centred dialog with a mobile bottom sheet / desktop dialog hybrid. Added sticky header/footer sections, textarea placement, and maintained quantity controls inside a fixed footer strip. |
| 812b4ff | 2025-08-14 | `components/MenuItemCard.tsx` | Ensured the modal truly overlays the page by adding inert handling to the background card, using a two-layer backdrop (blurred scrim + content container), and tightening spacing on the sticky footer. |
| ee56345 | 2025-08-14 | `components/MenuItemCard.tsx` | Hardened overlay stacking and scroll locking: pushed the backdrop/container up the z-index stack, enforced document scroll lock, and synced related layout z-index values. |
| 8277da4 | 2025-08-14 | `components/MenuItemCard.tsx` | Follow-up hotfix to force the modal wrapper to z-[9999] and make the scroll lock unconditional to avoid chips/nav overlapping the sheet. |
| a00d5bc | 2025-08-14 | `components/MenuItemCard.tsx` | Rendered the modal/backdrop through `createPortal` to escape stacking contexts, refactored the JSX structure accordingly, and centralised the overlay nodes. |
| 4aeb37b | 2025-08-14 | `components/MenuItemCard.tsx` | Restored the "Add to Plate" copy, tweaked the footer layout inside the modal, and aligned button sizing with the portal-based structure. |
| 595108e | 2025-08-14 | `components/MenuItemCard.tsx` | Added dietary/age badges to the modal header alongside the price display for quick context. |
| 1f0f655 | 2025-08-14 | `components/AddonGroups.tsx`, `components/MenuItemCard.tsx` | Major visual overhaul: introduced animated entry, header hero image gradients, accent-coloured badge pills, and refined sticky chrome. `AddonGroups` gained the scroll-fading carousel, accent-aware selection tint/inner ring, and keyboard-focus affordances while removing console diagnostics. |
| 083a715 | 2025-08-14 | `components/MenuItemCard.tsx`, `utils/getAddonsForItem.ts` | Switched add-on fetching to use `item_addon_links`, added structured debug logging, and kept modal logic intact. This is the commit where data loading changed materially. |
| 8a76c34 | 2025-08-27 | `components/MenuItemCard.tsx` | Applied the "frosted" polish: pill search, brand-aware chips, elevated card hover states, and matched modal CTA styling with the new accent system. |
| 3444326 | 2025-08-27 | `components/MenuItemCard.tsx` | Refined the modal header (legible text over hero image, consistent price treatment), hid empty add-on sections, and ensured badges appear with accent colouring. |
| 5314e17 | 2025-08-27 | `components/MenuItemCard.tsx` | Premium polish pass that rebalanced typography/spacing, refreshed the frosted backdrop overlays, and harmonised modal visuals with the rest of the menu revamp. |
| f7b07c7 | 2025-08-27 | `components/MenuItemCard.tsx` | Final UI tidy-up: moved the menu description beneath the cover image, adjusted logo wrappers, and tuned badge colours in both the card and modal. |

## Additional notes

- No standalone `components/ItemModal.tsx` exists in the reachable history. The modal has always lived inside `components/MenuItemCard.tsx` since the initial commit.
- The legacy `AddonGroups` component shipped alongside the first modal implementation and evolved through accent-aware styling in commit 1f0f655.

## Restored artifacts

- `components/legacy/OriginalMenuItemCard.tsx` now contains the untouched modal from commit 43b0181 for reference without disturbing current UI.
