-- ============================================================================
-- SEGURIDAD - PASO 3: cuentas de cliente (login con Google, /#cuenta)
-- Supabase > SQL Editor > New query > pegar todo > Run
-- Requiere haber corrido antes el paso 1 y el paso 2.
-- ============================================================================
-- Agrega el rol 'cliente', separado de las cuentas de staff (admin/profesional/
-- recepcionista/encargado). A diferencia del alta de staff (que necesita que el
-- admin apruebe desde luffy_pending), una cuenta de cliente se autoaprueba sola
-- apenas entra con Google -- no tiene sentido que Ivo tenga que aprobar clientes
-- uno por uno. Pero el rol 'cliente' solo puede escribir su propia ficha
-- (luffy/clientes, mismo documento grande de siempre) y el hold de turno de la
-- reserva publica -- nada de catalogo, agenda ajena, ni plata.

-- 1) Permitir el nuevo valor de rol.
alter table public.luffy_roles drop constraint if exists luffy_roles_role_check;
alter table public.luffy_roles add constraint luffy_roles_role_check
  check (role in ('admin','profesional','recepcionista','encargado','cliente'));

-- 2) Un cliente recien logueado con Google se asigna a si mismo el rol 'cliente'
--    (uid = su propio uid, app_id con el prefijo fijo 'cli_' para que nunca choque
--    con el app_id de una cuenta de staff) -- nunca puede pedirse otro rol.
drop policy if exists cliente_autoalta on public.luffy_roles;
create policy cliente_autoalta on public.luffy_roles
  for insert to authenticated
  with check (uid = auth.uid() and role = 'cliente' and app_id = 'cli_' || replace(auth.uid()::text,'-',''));

-- 3) Que puede ESCRIBIR el rol 'cliente': su propia ficha en luffy/clientes (la app
--    se encarga de tocar solo la suya, mismo nivel de confianza que ya se usa hoy
--    para otros documentos compartidos) y el hold temporal de turno. Nada mas.
--    (La lectura no cambia: el resto de las reglas de luffy_puede_leer ya bloquean
--    finanzas/proveedores y lo personal de cada cuenta de staff para cualquier
--    rol que no sea el dueño o el admin, 'cliente' incluido.)
create or replace function public.luffy_puede_escribir(k text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.luffy_role() is null then false
    when public.luffy_role() = 'admin' then true
    when public.luffy_role() = 'cliente' then k in ('luffy/clientes','luffy/reservas_holds')
    when starts_with(k, 'luffy/dinero_')  then (public.luffy_role() = 'recepcionista' or k = 'luffy/dinero_'  || public.luffy_app_id())
    when starts_with(k, 'luffy/yo_')      then k = 'luffy/yo_'      || public.luffy_app_id()
    when starts_with(k, 'luffy/perfil_')  then k = 'luffy/perfil_'  || public.luffy_app_id()
    when starts_with(k, 'luffy/horario_') then k = 'luffy/horario_' || public.luffy_app_id()
    when starts_with(k, 'luffy/rec_')     then k = 'luffy/rec_'     || public.luffy_app_id()
    when starts_with(k, 'luffy/caja_') then public.luffy_role() = 'recepcionista'
    when k in ('luffy/users','luffy/servicios','luffy/ofertas','luffy/combos','luffy/rubros',
               'luffy/reglas_reels','luffy/story_horarios','luffy/stories_rec_textos','luffy/tareas_recepcion','luffy/sucursales','luffy/epoca','luffy/promos_cfg','luffy/puntos_reglas','luffy/finanzas','luffy/proveedores','luffy/turnos_rec','luffy/decisiones_com') then false
    else true
  end
$$;
