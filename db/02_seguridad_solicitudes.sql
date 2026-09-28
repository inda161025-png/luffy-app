-- ============================================================================
-- SEGURIDAD - PASO 1b: reglas de las solicitudes de cuenta nueva
-- (no bloquea nada; corrige el error "violates row-level security policy for table luffy_pending")
-- Supabase > SQL Editor > New query > pegar todo > Run
-- ============================================================================
-- Cada persona crea y ve SU propia solicitud; el admin ve y borra todas.

drop policy if exists pend_insertar on public.luffy_pending;
drop policy if exists pend_ver      on public.luffy_pending;
drop policy if exists pend_borrar   on public.luffy_pending;

create policy pend_insertar on public.luffy_pending
  for insert to authenticated with check (uid = auth.uid());

create policy pend_ver on public.luffy_pending
  for select to authenticated using (uid = auth.uid() or public.luffy_role() = 'admin');

create policy pend_borrar on public.luffy_pending
  for delete to authenticated using (uid = auth.uid() or public.luffy_role() = 'admin');

-- El admin tiene que poder dar de alta el rol de una cuenta aprobada.
-- Mientras la base siga abierta (antes del paso 2), esto ya lo permite la regla temporal del paso 1.
