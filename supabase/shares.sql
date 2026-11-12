-- =============================================================================
-- Run it · compartir ejercicios y sesiones
-- Se pega entero en Supabase → SQL Editor → New query → Run (después de schema.sql).
-- Se puede ejecutar más de una vez sin romper nada.
-- =============================================================================

-- Cada fila es algo compartido: una COPIA del ejercicio o de la sesión (con sus ejercicios),
-- tal como estaba al compartirlo. Dos formas, en la misma tabla:
--   · recipient_email vacío  → enlace: lo puede abrir cualquiera que tenga el código (el id)
--   · recipient_email lleno  → compartido con una cuenta: solo lo ve quien entra con ese correo
create table if not exists public.shares (
  id text primary key check (id ~ '^[A-Za-z0-9]{8,32}$'),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- correo de quien lo comparte, para que quien lo recibe sepa de quién viene
  owner_email text not null default lower(auth.jwt() ->> 'email'),
  kind text not null check (kind in ('exercise', 'session')),
  title text not null check (char_length(title) <= 120),
  data jsonb not null check (pg_column_size(data) < 2000000),
  recipient_email text check (recipient_email is null or recipient_email = lower(recipient_email)),
  -- quien lo recibe puede marcarlo como visto (guardado o descartado) para que no le salga más
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists shares_owner on public.shares (owner, created_at desc);
create index if not exists shares_recipient on public.shares (recipient_email, created_at desc);

alter table public.shares enable row level security;

-- quien comparte: crear, ver y borrar lo suyo
drop policy if exists "crear lo mío" on public.shares;
-- (y el correo de quien comparte tiene que ser el suyo: no se puede hacer pasar por otro)
create policy "crear lo mío" on public.shares for insert to authenticated
  with check (owner = auth.uid() and owner_email = lower(auth.jwt() ->> 'email'));

drop policy if exists "ver lo mío o lo que me han mandado" on public.shares;
create policy "ver lo mío o lo que me han mandado" on public.shares for select to authenticated
  using (owner = auth.uid() or recipient_email = lower(auth.jwt() ->> 'email'));

drop policy if exists "borrar lo mío" on public.shares;
create policy "borrar lo mío" on public.shares for delete to authenticated using (owner = auth.uid());

-- quien lo recibe: solo puede cambiar la marca «visto» (y nada más: ver los permisos de columna)
drop policy if exists "marcar lo recibido" on public.shares;
create policy "marcar lo recibido" on public.shares for update to authenticated
  using (recipient_email = lower(auth.jwt() ->> 'email'))
  with check (recipient_email = lower(auth.jwt() ->> 'email'));
revoke update on public.shares from authenticated, anon;
grant update (dismissed) on public.shares to authenticated;

-- -----------------------------------------------------------------------------
-- Abrir un enlace sin cuenta. No hay ninguna regla que deje leer la tabla a quien no ha entrado
-- (si la hubiera, podría listarlo todo). En su lugar, esta función devuelve UNA fila por su código,
-- y solo si es un enlace (no algo compartido con una cuenta).
-- -----------------------------------------------------------------------------
create or replace function public.get_share(share_id text)
returns table (kind text, title text, data jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.kind, s.title, s.data, s.created_at
  from public.shares s
  where s.id = share_id and s.recipient_email is null;
$$;

revoke all on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;
