-- ============================================================================
-- SEGURIDAD - PASO 1 de 2: PREPARACION  (no bloquea nada, la app sigue andando igual)
-- Supabase > SQL Editor > New query > pegar todo > Run
-- ============================================================================
-- Crea las tablas que dicen QUIEN es cada persona (y con que rol), y las
-- funciones que despues usan las reglas de acceso. Deja una regla TEMPORAL que
-- permite cargar las cuentas existentes; el paso 2 la elimina.

-- 1) Roles: cada cuenta de Supabase Auth queda atada a un usuario de la app y a un rol.
--    Esto es lo que manda para los permisos (el usuario no puede modificarlo).
create table if not exists public.luffy_roles (
  uid        uuid primary key references auth.users(id) on delete cascade,
  app_id     text not null unique,
  role       text not null check (role in ('admin','profesional','recepcionista','encargado')),
  created_at timestamptz not null default now()
);

-- 2) Cuentas nuevas que esperan la aprobacion del admin.
create table if not exists public.luffy_pending (
  uid        uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.luffy_roles   enable row level security;
alter table public.luffy_pending enable row level security;

-- 3) Funciones auxiliares (se ejecutan con permisos del sistema para poder leer luffy_roles).
create or replace function public.luffy_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.luffy_roles where uid = auth.uid()
$$;

create or replace function public.luffy_app_id()
returns text language sql stable security definer set search_path = public as $$
  select app_id from public.luffy_roles where uid = auth.uid()
$$;

-- 4) TEMPORAL: permite cargar/consultar los roles de las cuentas existentes.
--    El paso 2 elimina estas dos reglas.
drop policy if exists "tmp migracion roles insert" on public.luffy_roles;
create policy "tmp migracion roles insert" on public.luffy_roles
  for insert to anon, authenticated with check (true);

drop policy if exists "tmp migracion roles select" on public.luffy_roles;
create policy "tmp migracion roles select" on public.luffy_roles
  for select to anon, authenticated using (true);
