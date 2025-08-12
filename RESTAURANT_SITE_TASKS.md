# Restaurant Site – Worklog & Checklist (Preview Mode)

## Active Constraints
- Customer site is viewed via dashboard preview; sub/wildcard domains pending.
- Orders page preview uses querystring `user_id` fallback, else current auth user.

## Tracking
- All /restaurant pages must share layout: `max-w-screen-sm mx-auto px-4 pb-24`.
- No emoji decorations on the homepage background.
- No wavy section dividers.
- Remove legacy green floating cart button everywhere.
- Ensure footer tab bar shows on every /restaurant page (Home, Menu, Orders, More).

## TODO (check off in future PRs)
- [ ] Settings-driven site content (logo, hero, gallery, details, opening times).
- [ ] Themes (color + layout presets).
- [ ] Custom pages list from `restaurant_pages`.
- [ ] Orders query: customer auth flow (future).
- [ ] Replace category placeholders with SVG cuisine icons.
