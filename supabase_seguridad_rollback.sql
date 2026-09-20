-- ============================================================================
-- ROLLBACK: vuelve al acceso abierto de antes (usar solo si el paso 2 dejo a alguien sin poder entrar)
-- Supabase > SQL Editor > New query > pegar todo > Run
-- ============================================================================
drop policy if exists luffy_leer       on public.luffy_data;
drop policy if exists luffy_insertar   on public.luffy_data;
drop policy if exists luffy_actualizar on public.luffy_data;

drop policy if exists "anon can read luffy_data"   on public.luffy_data;
drop policy if exists "anon can insert luffy_data" on public.luffy_data;
drop policy if exists "anon can update luffy_data" on public.luffy_data;
create policy "anon can read luffy_data"   on public.luffy_data for select using (true);
create policy "anon can insert luffy_data" on public.luffy_data for insert with check (true);
create policy "anon can update luffy_data" on public.luffy_data for update using (true);

-- las tablas de roles vuelven al modo de migracion
drop policy if exists "tmp migracion roles insert" on public.luffy_roles;
drop policy if exists "tmp migracion roles select" on public.luffy_roles;
create policy "tmp migracion roles insert" on public.luffy_roles for insert to anon, authenticated with check (true);
create policy "tmp migracion roles select" on public.luffy_roles for select to anon, authenticated using (true);
