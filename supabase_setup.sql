-- Ejecutar una sola vez en Supabase (Project INDANETA) > SQL Editor > New query > Run

create table if not exists luffy_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table luffy_data enable row level security;

-- La app no usa Supabase Auth (tiene su propio login), así que estas políticas
-- permiten leer/escribir con la anon key. No hay datos de pago ni de tarjetas;
-- es aceptable para una herramienta interna de equipo chico.
create policy "anon can read luffy_data" on luffy_data
  for select using (true);

create policy "anon can insert luffy_data" on luffy_data
  for insert with check (true);

create policy "anon can update luffy_data" on luffy_data
  for update using (true);
