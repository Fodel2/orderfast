-- Add short_order_number column to orders
alter table orders
  add column if not exists short_order_number integer;

-- Ensure uniqueness per restaurant
alter table orders
  add constraint if not exists orders_restaurant_short_no_key unique (restaurant_id, short_order_number);
