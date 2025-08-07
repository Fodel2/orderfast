# orderfast

## Development

1. Install dependencies with `npm install`.
2. Run tests using `npm run test:ci`.

## 📌 Project Implementation Notes (Customer Restaurant Site)

- This is the **customer-facing site** for restaurant ordering (`/restaurant/...`)
- It is **not the main marketing site** (`/`)
- All paths must follow `/restaurant/:page` — e.g. `/restaurant/menu`, `/restaurant/cart`, `/restaurant/orders`
- Orders must support both **authenticated** and **guest** customers:
  - Orders may be stored using `user_id` or `guest_email`
  - Queries must `.or()` these fields when fetching
- Cart logic is centralized and shared:
  - Drawer logic lives in `components/CartDrawer.tsx`
  - Page version is at `pages/restaurant/cart.tsx`
- A floating green cart button used in early builds must no longer be used — remove any instance of it from global layout
- The app must support **mobile-first design** and consistent styling across all pages and future dynamic restaurant-created pages

