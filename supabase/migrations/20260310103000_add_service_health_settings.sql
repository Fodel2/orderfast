alter table if exists restaurants
  add column if not exists expected_prep_minutes integer not null default 10,
  add column if not exists busy_prep_minutes integer not null default 12,
  add column if not exists backlog_prep_minutes integer not null default 18,
  add column if not exists busy_order_threshold integer not null default 6,
  add column if not exists backlog_order_threshold integer not null default 10;
