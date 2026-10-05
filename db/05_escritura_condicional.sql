-- 05: escritura condicional por versión para luffy_data.
-- Cierra la carrera de dos dispositivos que escriben el mismo documento a la vez:
-- la escritura solo se aplica si la versión que tenía el cliente es la que está en la base.
-- Requiere 00 y 03/04 ya aplicados. Revertir con db/rollback_escritura_condicional.sql.
-- NO aplicar sin revisar: esta versión solo agrega la columna y la función; la app todavía no la usa.

alter table public.luffy_data add column if not exists version bigint not null default 0;

create or replace function public.luffy_guardar(p_key text, p_value jsonb, p_version_esperada bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actual bigint;
  v_nueva bigint;
begin
  select version into v_actual from public.luffy_data where key = p_key for update;

  if not found then
    if p_version_esperada <> 0 then
      return jsonb_build_object('ok', false, 'motivo', 'conflicto', 'version', null);
    end if;
    insert into public.luffy_data (key, value, updated_at, version) values (p_key, p_value, now(), 1);
    return jsonb_build_object('ok', true, 'version', 1);
  end if;

  if v_actual <> p_version_esperada then
    return jsonb_build_object('ok', false, 'motivo', 'conflicto', 'version', v_actual);
  end if;

  v_nueva := v_actual + 1;
  update public.luffy_data set value = p_value, updated_at = now(), version = v_nueva where key = p_key;
  return jsonb_build_object('ok', true, 'version', v_nueva);
end;
$$;

grant execute on function public.luffy_guardar(text, jsonb, bigint) to anon, authenticated;
