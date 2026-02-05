alter table public.orders
  alter column short_order_number type integer
  using short_order_number::integer;

alter table public.orders
  drop constraint if exists orders_restaurant_short_no_key;

drop table if exists public.order_short_number_counters;

create table if not exists public.restaurant_order_counters (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  next_number bigint not null default 1
);

create or replace function public.assign_short_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate integer;
  attempts integer := 0;
  max_attempts integer := 10000;
begin
  if new.short_order_number is not null then
    return new;
  end if;

  if new.restaurant_id is null then
    raise exception 'orders.restaurant_id is required to assign short_order_number';
  end if;

  loop
    attempts := attempts + 1;
    if attempts > max_attempts then
      raise exception 'No available short order numbers for restaurant %', new.restaurant_id;
    end if;

    with next_counter as (
      insert into public.restaurant_order_counters (restaurant_id, next_number)
      values (new.restaurant_id, 1)
      on conflict (restaurant_id) do update
      set next_number = public.restaurant_order_counters.next_number + 1
      returning next_number
    )
    select (((next_number - 1) % 9999) + 1)::integer
      into candidate
      from next_counter;

    if not exists (
      select 1
      from public.orders
      where restaurant_id = new.restaurant_id
        and short_order_number = candidate
        and status in ('pending', 'accepted', 'preparing', 'delivering', 'ready_to_collect')
    ) then
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

create unique index if not exists orders_active_short_order_number_unique
  on public.orders (restaurant_id, short_order_number)
  where status in ('pending', 'accepted', 'preparing', 'delivering', 'ready_to_collect');
