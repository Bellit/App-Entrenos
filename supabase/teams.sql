-- =============================================================================
-- Run it · equipos (se sincronizan igual que ejercicios y sesiones)
-- Se pega entero en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- =============================================================================

create table if not exists public.squads (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb,
  deleted boolean not null default false,
  updated_at bigint not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists squads_user_synced on public.squads (user_id, synced_at);

-- synced_at siempre lo pone el servidor (la función ya existe: la creó schema.sql)
drop trigger if exists squads_synced_at on public.squads;
create trigger squads_synced_at before insert or update on public.squads
  for each row execute function public.set_synced_at();

-- cada persona solo ve y cambia sus equipos
alter table public.squads enable row level security;
drop policy if exists "solo lo mío" on public.squads;
create policy "solo lo mío" on public.squads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.squads drop constraint if exists squads_data_size;
alter table public.squads add constraint squads_data_size check (pg_column_size(data) < 200000);
