-- VendorScorePro v0.9.17
-- Doel: dubbele applicatiekaarten voorkomen wanneer meerdere functioneel beheerders
-- aan dezelfde applicatie zijn gekoppeld.
--
-- Principe:
-- - Applicatie = product/dienst onder leverancier
-- - Functioneel beheer = meerdere personen/records gekoppeld aan één applicatie
-- - Daarom mogen er meerdere functioneel beheerders per applicatie zijn,
--   maar niet meerdere applicatieregels met dezelfde naam bij dezelfde leverancier.

-- 1. Dubbele records in applications opschonen en relaties omhangen naar de te behouden applicatie.
with ranked as (
  select
    id,
    first_value(id) over (
      partition by organization_id, supplier_id, lower(trim(name))
      order by created_at nulls last, id::text
    ) as keep_id,
    row_number() over (
      partition by organization_id, supplier_id, lower(trim(name))
      order by created_at nulls last, id::text
    ) as rn
  from public.applications
  where name is not null
    and trim(name) <> ''
)
update public.functional_admin_assignments faa
set application_id = ranked.keep_id,
    updated_at = now()
from ranked
where ranked.rn > 1
  and faa.application_id = ranked.id;

with ranked as (
  select
    id,
    first_value(id) over (
      partition by organization_id, supplier_id, lower(trim(name))
      order by created_at nulls last, id::text
    ) as keep_id,
    row_number() over (
      partition by organization_id, supplier_id, lower(trim(name))
      order by created_at nulls last, id::text
    ) as rn
  from public.applications
  where name is not null
    and trim(name) <> ''
)
update public.application_contract_summaries acs
set application_id = ranked.keep_id,
    updated_at = now()
from ranked
where ranked.rn > 1
  and acs.application_id = ranked.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by organization_id, supplier_id, lower(trim(name))
      order by created_at nulls last, id::text
    ) as rn
  from public.applications
  where name is not null
    and trim(name) <> ''
)
delete from public.applications a
using ranked
where a.id = ranked.id
  and ranked.rn > 1;

-- 2. Unieke index zodat dezelfde applicatienaam per leverancier/organisatie niet opnieuw dubbel wordt opgeslagen.
create unique index if not exists applications_org_supplier_name_unique
on public.applications (organization_id, supplier_id, lower(trim(name)))
where name is not null and trim(name) <> '';

-- 3. Legacy-tabel, indien aanwezig, ook opschonen. Deze tabel werd in oudere builds gebruikt.
do $$
begin
  if to_regclass('public.supplier_applications') is not null then
    execute $sql$
      with ranked as (
        select
          id,
          row_number() over (
            partition by organization_id, supplier_id, lower(trim(coalesce(name, application_name, title))))
            order by created_at nulls last, id::text
          ) as rn
        from public.supplier_applications
        where trim(coalesce(name, application_name, title, '')) <> ''
      )
      delete from public.supplier_applications sa
      using ranked
      where sa.id = ranked.id
        and ranked.rn > 1
    $sql$;

    execute $sql$
      create unique index if not exists supplier_applications_org_supplier_name_unique
      on public.supplier_applications (organization_id, supplier_id, lower(trim(coalesce(name, application_name, title))))
      where trim(coalesce(name, application_name, title, '')) <> ''
    $sql$;
  end if;
end $$;

notify pgrst, 'reload schema';
