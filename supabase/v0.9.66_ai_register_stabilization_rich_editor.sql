-- VendorScorePro v0.9.66 - AI-register stabilisatie & rich editor
-- Doel: dubbele AI-registeritems voorkomen en RLS voor AI-register borgen.

alter table public.ai_register enable row level security;

drop policy if exists "ai_register_select_own_org" on public.ai_register;
drop policy if exists "ai_register_insert_own_org" on public.ai_register;
drop policy if exists "ai_register_update_own_org" on public.ai_register;
drop policy if exists "ai_register_delete_own_org" on public.ai_register;

create policy "ai_register_select_own_org"
on public.ai_register
for select
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "ai_register_insert_own_org"
on public.ai_register
for insert
to authenticated
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
  and (
    created_by is null
    or created_by = auth.uid()
  )
);

create policy "ai_register_update_own_org"
on public.ai_register
for update
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
)
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "ai_register_delete_own_org"
on public.ai_register
for delete
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

grant select, insert, update, delete on public.ai_register to authenticated;

-- Duplicaatpreventie: organisatie + leverancier + applicatie + naam.
-- Bij bestaande duplicaten wordt de unieke index bewust overgeslagen zodat de migratie niet faalt.
do $$
begin
  if not exists (
    select 1
    from (
      select
        organization_id,
        coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid) as supplier_id,
        coalesce(application_id, '00000000-0000-0000-0000-000000000000'::uuid) as application_id,
        lower(trim(name)) as normalized_name,
        count(*)
      from public.ai_register
      group by 1,2,3,4
      having count(*) > 1
    ) duplicates
  ) then
    create unique index if not exists ai_register_unique_entry
    on public.ai_register (
      organization_id,
      coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(application_id, '00000000-0000-0000-0000-000000000000'::uuid),
      lower(trim(name))
    );
  else
    raise notice 'ai_register_unique_entry is niet aangemaakt omdat er nog dubbele AI-registeritems bestaan. Ruim duplicaten op en voer dit script opnieuw uit.';
  end if;
end $$;

notify pgrst, 'reload schema';
