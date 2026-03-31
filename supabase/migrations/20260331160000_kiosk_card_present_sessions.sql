create table if not exists public.kiosk_card_present_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid null references public.orders(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (char_length(currency) between 3 and 8),
  state text not null default 'created' check (
    state in (
      'created',
      'readiness_verified',
      'native_preparing',
      'ready_to_collect',
      'collecting',
      'processing',
      'succeeded',
      'failed',
      'canceled',
      'finalized',
      'needs_reconciliation'
    )
  ),
  stripe_connected_account_id text not null,
  stripe_terminal_location_id text not null,
  stripe_payment_intent_id text null,
  idempotency_key text not null,
  kiosk_install_id text null,
  failure_code text null,
  failure_message text null,
  metadata jsonb not null default '{}'::jsonb,
  finalized_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, idempotency_key)
);

create index if not exists kiosk_card_present_sessions_restaurant_idx
  on public.kiosk_card_present_sessions (restaurant_id, created_at desc);

create index if not exists kiosk_card_present_sessions_state_idx
  on public.kiosk_card_present_sessions (state, updated_at desc);

create index if not exists kiosk_card_present_sessions_payment_intent_idx
  on public.kiosk_card_present_sessions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create table if not exists public.kiosk_card_present_events (
  id bigserial primary key,
  session_id uuid not null references public.kiosk_card_present_sessions(id) on delete cascade,
  state text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists kiosk_card_present_events_session_idx
  on public.kiosk_card_present_events (session_id, created_at asc);

alter table public.kiosk_card_present_sessions enable row level security;
alter table public.kiosk_card_present_events enable row level security;
