create table if not exists public.labdm_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.labdm_state enable row level security;

drop policy if exists "labdm_state_read" on public.labdm_state;
drop policy if exists "labdm_state_insert" on public.labdm_state;
drop policy if exists "labdm_state_update" on public.labdm_state;

create policy "labdm_state_read"
on public.labdm_state
for select
using (true);

create policy "labdm_state_insert"
on public.labdm_state
for insert
with check (true);

create policy "labdm_state_update"
on public.labdm_state
for update
using (true)
with check (true);
