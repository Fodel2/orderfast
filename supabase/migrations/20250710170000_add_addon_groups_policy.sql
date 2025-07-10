-- Allow restaurant members to manage their own addon_groups
alter table addon_groups enable row level security;

create policy "Allow insert for restaurant users" on addon_groups
  for insert
  with check (
    restaurant_id in (
      select restaurant_id from restaurant_users ru
      where ru.restaurant_id = addon_groups.restaurant_id
        and ru.user_id = auth.uid()
    )
  );
