-- VendorScorePro v0.9.64 - Beheerbare dropdowns voor Applicatie- & Licentieregister
-- Doel: applicatietype en KeyUser als beheerbare waardelijsten gebruiken.

create table if not exists public.lookup_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  category text not null,
  value text not null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists lookup_values_org_category_value_unique
on public.lookup_values (
  coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
  category,
  value
);

alter table public.lookup_values enable row level security;

drop policy if exists "lookup_values_select_own_org" on public.lookup_values;
create policy "lookup_values_select_own_org"
on public.lookup_values
for select
to authenticated
using (
  organization_id is null
  or organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "lookup_values_insert_admin_own_org" on public.lookup_values;
create policy "lookup_values_insert_admin_own_org"
on public.lookup_values
for insert
to authenticated
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
      and role in ('admin','editor')
  )
);

drop policy if exists "lookup_values_update_admin_own_org" on public.lookup_values;
create policy "lookup_values_update_admin_own_org"
on public.lookup_values
for update
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
      and role in ('admin','editor')
  )
)
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
      and role in ('admin','editor')
  )
);

grant select, insert, update on public.lookup_values to authenticated;

-- Seed voor Gilde Opleidingen. Indien gewenst later via Instellingen -> Waardelijsten aanpassen.
with org as (
  select '7ec54263-6b9b-4cb2-9b97-526d8909550d'::uuid as organization_id
), seed(category, value, sort_order) as (
  values
    ('application_type', 'ICT', 1),
    ('application_type', 'Kantoorapplicatie', 2),
    ('application_type', 'Onderwijs', 3),
    ('application_type', 'Huisvesting', 4),
    ('application_type', 'Bedrijfsondersteunend', 5),
    ('application_type', 'Koppelingen', 6),
    ('application_type', 'Landschap', 7),
    ('application_type', 'Overig', 99),

    ('key_user', 'Helpdesk', 1),
    ('key_user', 'Rick Gerards', 2),
    ('key_user', 'Kim Heyen', 3),
    ('key_user', 'Frank van Grinsven', 4),
    ('key_user', 'Keny Joosten', 5),
    ('key_user', 'Onbekend', 99),

    ('software_classification', 'Burcht', 1),
    ('software_classification', 'Stad', 2),
    ('software_classification', 'Land', 3),
    ('software_classification', 'Schiereiland', 4),
    ('software_classification', 'Nog niet geclassificeerd', 99),

    ('installation_source', 'Intune', 1),
    ('installation_source', 'MECM', 2),
    ('installation_source', 'Jamf', 3),
    ('installation_source', 'Entra ID', 4),
    ('installation_source', 'Leverancier', 5),
    ('installation_source', 'Functioneel Beheer', 6),
    ('installation_source', 'Handmatig', 7),
    ('installation_source', 'Onbekend', 99),

    ('license_model', 'Per Gebruiker', 1),
    ('license_model', 'Per Student', 2),
    ('license_model', 'Per Medewerker', 3),
    ('license_model', 'Per Device', 4),
    ('license_model', 'Gelijktijdige Gebruikers', 5),
    ('license_model', 'Organisatiebreed', 6),
    ('license_model', 'Onbeperkt', 7),
    ('license_model', 'Geen Licentie', 8),
    ('license_model', 'Overig', 99),

    ('license_usage_source', 'DUO', 1),
    ('license_usage_source', 'Intune', 2),
    ('license_usage_source', 'Entra ID', 3),
    ('license_usage_source', 'AFAS', 4),
    ('license_usage_source', 'Eduarte', 5),
    ('license_usage_source', 'Leverancier', 6),
    ('license_usage_source', 'Functioneel Beheer', 7),
    ('license_usage_source', 'Handmatig', 8),
    ('license_usage_source', 'Anders', 99),

    ('license_unit', 'Gebruiker', 1),
    ('license_unit', 'Student', 2),
    ('license_unit', 'Medewerker', 3),
    ('license_unit', 'Device', 4),
    ('license_unit', 'FTE', 5),
    ('license_unit', 'Credit', 6),
    ('license_unit', 'Transactie', 7),
    ('license_unit', 'Organisatie', 8),
    ('license_unit', 'Installatie', 9)
)
insert into public.lookup_values (organization_id, category, value, sort_order, is_active)
select org.organization_id, seed.category, seed.value, seed.sort_order, true
from org cross join seed
on conflict do nothing;

notify pgrst, 'reload schema';
