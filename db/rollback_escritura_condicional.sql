-- Rollback de db/05_escritura_condicional.sql: quita la función y la columna version.
-- Seguro de correr: la app actual no depende de ninguna de las dos cosas.

drop function if exists public.luffy_guardar(text, jsonb, bigint);
alter table public.luffy_data drop column if exists version;
