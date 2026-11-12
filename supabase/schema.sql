-- =============================================================================
-- Run it · tablas en Supabase para sincronizar ejercicios y sesiones
-- Se pega entero en Supabase → SQL Editor → New query → Run. Se puede ejecutar
-- más de una vez sin romper nada (usa «if not exists» y «or replace»).
-- =============================================================================

-- Cada ejercicio y cada sesión se guarda como un documento JSON (la columna `data`),
-- igual que en el navegador. Así el formato lo decide la app y la base de datos no
-- tiene que cambiar cada vez que añadimos un campo.
--
--   id          id del ejercicio o la sesión (el mismo que en el dispositivo)
--   user_id     de quién es: lo pone Supabase solo, con la persona que ha entrado
--   data        el documento; null si está borrado
--   deleted     marca de borrado: así el borrado llega a los demás dispositivos
--   updated_at  cuándo se cambió en el dispositivo (milisegundos): gana el más reciente
--   synced_at   cuándo llegó al servidor (hora del servidor): sirve para pedir
--               «lo que ha cambiado desde la última vez» sin fiarse del reloj del móvil

create table if not exists public.exercises (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb,
  deleted boolean not null default false,
  updated_at bigint not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.sessions (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb,
  deleted boolean not null default false,
  updated_at bigint not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists exercises_user_synced on public.exercises (user_id, synced_at);
create index if not exists sessions_user_synced on public.sessions (user_id, synced_at);

-- synced_at siempre lo pone el servidor, también al actualizar (no se puede falsear desde la app)
create or replace function public.set_synced_at() returns trigger
language plpgsql as $$
begin
  new.synced_at := now();
  return new;
end;
$$;

drop trigger if exists exercises_synced_at on public.exercises;
create trigger exercises_synced_at before insert or update on public.exercises
  for each row execute function public.set_synced_at();

drop trigger if exists sessions_synced_at on public.sessions;
create trigger sessions_synced_at before insert or update on public.sessions
  for each row execute function public.set_synced_at();

-- -----------------------------------------------------------------------------
-- Seguridad (Row Level Security): cada persona solo ve y cambia SUS filas.
-- Sin estas reglas, cualquiera con la clave pública podría leerlo todo.
-- -----------------------------------------------------------------------------
alter table public.exercises enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "solo lo mío" on public.exercises;
create policy "solo lo mío" on public.exercises
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "solo lo mío" on public.sessions;
create policy "solo lo mío" on public.sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Límite de tamaño por documento (1 MB), para que un error no llene la base de datos
alter table public.exercises drop constraint if exists exercises_data_size;
alter table public.exercises add constraint exercises_data_size check (pg_column_size(data) < 1000000);
alter table public.sessions drop constraint if exists sessions_data_size;
alter table public.sessions add constraint sessions_data_size check (pg_column_size(data) < 1000000);
