-- VendorScorePro v0.9.60
-- Centrale waardelijsten voor dropdowns in het Applicatie- & Licentieregister.
-- Minimale backend-impact: één generieke lookup-tabel, bestaande velden blijven leidend.

create table if not exists public.lookup_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  category text not null,
  value text not null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint lookup_values_org_category_value_unique unique (organization_id, category, value)
);

alter table public.lookup_values enable row level security;

drop policy if exists "lookup_values_select" on public.lookup_values;
drop policy if exists "lookup_values_insert" on public.lookup_values;
drop policy if exists "lookup_values_update" on public.lookup_values;
drop policy if exists "lookup_values_delete" on public.lookup_values;

create policy "lookup_values_select"
on public.lookup_values
for select
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "lookup_values_insert"
on public.lookup_values
for insert
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
    and role in ('admin', 'editor')
  )
);

create policy "lookup_values_update"
on public.lookup_values
for update
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
    and role in ('admin', 'editor')
  )
)
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
    and role in ('admin', 'editor')
  )
);

create policy "lookup_values_delete"
on public.lookup_values
for delete
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
    and role = 'admin'
  )
);

-- Standaardwaarden laden voor alle bestaande organisaties.
-- Waarden zijn bewust in consistente schrijfwijze opgenomen.
insert into public.lookup_values (organization_id, category, value, sort_order, is_active)
select o.id, v.category, v.value, v.sort_order, true
from public.organizations o
cross join (values
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
) as v(category, value, sort_order)
on conflict (organization_id, category, value) do update
set sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

notify pgrst, 'reload schema';
