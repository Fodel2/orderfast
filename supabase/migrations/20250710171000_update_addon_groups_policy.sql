-- Update RLS policy to allow restaurant owners and staff to insert addon groups
alter table addon_groups enable row level security;

drop policy if exists "Allow insert for restaurant users" on addon_groups;

create policy "Authenticated users can insert if they own the restaurant" on addon_groups
  for insert
  to authenticated
  using (
    restaurant_id in (
      select id from restaurants where owner_id = auth.uid()
    ) or restaurant_id in (
      select restaurant_id from restaurant_users where user_id = auth.uid()
    )
  );
