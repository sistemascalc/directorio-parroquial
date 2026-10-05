-- Ejecutar una vez en el SQL Editor del proyecto privado.
create table if not exists public.directorio_shared (
  owner uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  data jsonb not null check (jsonb_typeof(data->'parishes') = 'array' and jsonb_typeof(data->'addresses') = 'array')
);
alter table public.directorio_shared enable row level security;
revoke all on public.directorio_shared from anon;
grant select, insert, update on public.directorio_shared to authenticated;
create policy "leer directorio propio" on public.directorio_shared for select to authenticated using ((select auth.uid()) = owner);
create policy "crear directorio propio" on public.directorio_shared for insert to authenticated with check ((select auth.uid()) = owner);
create policy "actualizar directorio propio" on public.directorio_shared for update to authenticated using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
