create table if not exists public.order_short_number_counters (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  last_short_order_number integer not null default 999
);

create or replace function public.assign_short_order_number()
returns trigger
language plpgsql
as $$
declare
  candidate integer;
  attempts integer := 0;
  max_attempts integer := 9000;
begin
  if new.short_order_number is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.restaurant_id::text));

  insert into public.order_short_number_counters (restaurant_id, last_short_order_number)
  values (new.restaurant_id, 999)
  on conflict (restaurant_id) do nothing;

  select last_short_order_number
    into candidate
  from public.order_short_number_counters
  where restaurant_id = new.restaurant_id
  for update;

  loop
    candidate := candidate + 1;
    if candidate > 9999 then
      candidate := 1000;
    end if;

    attempts := attempts + 1;
    if attempts > max_attempts then
      raise exception 'No available short order numbers for restaurant %', new.restaurant_id;
    end if;

    if not exists (
      select 1
      from public.orders
      where restaurant_id = new.restaurant_id
        and short_order_number = candidate
    ) then
      update public.order_short_number_counters
      set last_short_order_number = candidate
      where restaurant_id = new.restaurant_id;

      new.short_order_number := candidate;
      return new;
    end if;
  end loop;
end;
$$;

drop trigger if exists assign_short_order_number on public.orders;
create trigger assign_short_order_number
before insert on public.orders
for each row
execute function public.assign_short_order_number();
