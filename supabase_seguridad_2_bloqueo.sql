-- ============================================================================
-- SEGURIDAD - PASO 2 de 2: BLOQUEO  (ejecutar SOLO cuando la app nueva ya esta publicada
-- y comprobamos juntos que todos pueden entrar)
-- Supabase > SQL Editor > New query > pegar todo > Run
-- Si algo sale mal: ejecutar supabase_seguridad_rollback.sql y queda como estaba.
-- ============================================================================

-- 1) Se elimina el acceso abierto: desde ahora hace falta iniciar sesion.
drop policy if exists "anon can read luffy_data"   on public.luffy_data;
drop policy if exists "anon can insert luffy_data" on public.luffy_data;
drop policy if exists "anon can update luffy_data" on public.luffy_data;
drop policy if exists "tmp migracion roles insert" on public.luffy_roles;
drop policy if exists "tmp migracion roles select" on public.luffy_roles;

-- 2) Quien puede LEER cada documento.
--    - Sin rol aprobado: nada.   - Admin: todo.
--    - dinero_<id>: su dueño y recepcion (necesita ver los cobros y las deudas).
--    - yo_/perfil_/horario_/rec_/clientes_<id>: solo su dueño (y el admin).
--    - todo lo demas (reels, puntos, catalogo, stock...): cualquier persona con rol.
create or replace function public.luffy_puede_leer(k text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.luffy_role() is null then false
    when public.luffy_role() = 'admin' then true
    when starts_with(k, 'luffy/dinero_')  then (public.luffy_role() = 'recepcionista' or k = 'luffy/dinero_'  || public.luffy_app_id())
    when starts_with(k, 'luffy/yo_')      then k = 'luffy/yo_'      || public.luffy_app_id()
    when starts_with(k, 'luffy/perfil_')  then k = 'luffy/perfil_'  || public.luffy_app_id()
    when starts_with(k, 'luffy/horario_') then k = 'luffy/horario_' || public.luffy_app_id()
    when starts_with(k, 'luffy/rec_')     then k = 'luffy/rec_'     || public.luffy_app_id()
    when starts_with(k, 'luffy/clientes_') then k = 'luffy/clientes_' || public.luffy_app_id()
    else true
  end
$$;

-- 3) Quien puede ESCRIBIR cada documento.
--    - Solo el admin: usuarios, servicios, ofertas, combos, rubros, reglas de reels, horarios de stories, tareas de recepcion, sucursales.
--    - dinero_<id>: su dueño y recepcion (cobra deudas).
--    - yo_/perfil_/horario_/rec_<id>: solo su dueño.
--    - todo lo demas: cualquier persona con rol.
create or replace function public.luffy_puede_escribir(k text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.luffy_role() is null then false
    when public.luffy_role() = 'admin' then true
    when starts_with(k, 'luffy/dinero_')  then (public.luffy_role() = 'recepcionista' or k = 'luffy/dinero_'  || public.luffy_app_id())
    when starts_with(k, 'luffy/yo_')      then k = 'luffy/yo_'      || public.luffy_app_id()
    when starts_with(k, 'luffy/perfil_')  then k = 'luffy/perfil_'  || public.luffy_app_id()
    when starts_with(k, 'luffy/horario_') then k = 'luffy/horario_' || public.luffy_app_id()
    when starts_with(k, 'luffy/rec_')     then k = 'luffy/rec_'     || public.luffy_app_id()
    when starts_with(k, 'luffy/clientes_') then k = 'luffy/clientes_' || public.luffy_app_id()
    when k in ('luffy/users','luffy/servicios','luffy/ofertas','luffy/combos','luffy/rubros',
               'luffy/reglas_reels','luffy/story_horarios','luffy/tareas_recepcion','luffy/sucursales','luffy/epoca') then false
    else true
  end
$$;

drop policy if exists luffy_leer       on public.luffy_data;
drop policy if exists luffy_insertar   on public.luffy_data;
drop policy if exists luffy_actualizar on public.luffy_data;

create policy luffy_leer on public.luffy_data
  for select to authenticated using (public.luffy_puede_leer(key));
create policy luffy_insertar on public.luffy_data
  for insert to authenticated with check (public.luffy_puede_escribir(key));
create policy luffy_actualizar on public.luffy_data
  for update to authenticated using (public.luffy_puede_escribir(key)) with check (public.luffy_puede_escribir(key));
-- (nadie puede borrar documentos)

-- 4) Roles: cada persona ve el suyo; solo el admin crea/modifica/borra roles (aprueba cuentas).
drop policy if exists roles_ver        on public.luffy_roles;
drop policy if exists roles_insertar   on public.luffy_roles;
drop policy if exists roles_actualizar on public.luffy_roles;
drop policy if exists roles_borrar     on public.luffy_roles;
create policy roles_ver        on public.luffy_roles for select to authenticated using (uid = auth.uid() or public.luffy_role() = 'admin');
create policy roles_insertar   on public.luffy_roles for insert to authenticated with check (public.luffy_role() = 'admin');
create policy roles_actualizar on public.luffy_roles for update to authenticated using (public.luffy_role() = 'admin') with check (public.luffy_role() = 'admin');
create policy roles_borrar     on public.luffy_roles for delete to authenticated using (public.luffy_role() = 'admin');

-- 5) Cuentas pendientes: cada persona crea y ve la suya; el admin ve y borra todas.
drop policy if exists pend_insertar on public.luffy_pending;
drop policy if exists pend_ver      on public.luffy_pending;
drop policy if exists pend_borrar   on public.luffy_pending;
create policy pend_insertar on public.luffy_pending for insert to authenticated with check (uid = auth.uid());
create policy pend_ver      on public.luffy_pending for select to authenticated using (uid = auth.uid() or public.luffy_role() = 'admin');
create policy pend_borrar   on public.luffy_pending for delete to authenticated using (uid = auth.uid() or public.luffy_role() = 'admin');
