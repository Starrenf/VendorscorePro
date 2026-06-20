-- VendorScorePro v0.9.50
-- Softwarelandschap: licentiebeheer en applicatie-opmerkingen
-- Deze uitbreiding raakt alleen de import-first softwarelandschap-tabel.

alter table public.software_landscape_import
  add column if not exists license_required boolean default false,
  add column if not exists license_model text,
  add column if not exists license_quantity numeric,
  add column if not exists license_actual_usage numeric,
  add column if not exists license_unit text,
  add column if not exists license_reference_date date,
  add column if not exists license_adjustment_moment text,
  add column if not exists license_true_up boolean default false,
  add column if not exists license_true_down boolean default false,
  add column if not exists license_usage_source text,
  add column if not exists license_last_review date,
  add column if not exists license_notes text,
  add column if not exists application_notes text;

-- Zorg dat bewerken/verwijderen via de frontend mogelijk blijft.
alter table public.software_landscape_import enable row level security;

drop policy if exists "software_landscape_delete" on public.software_landscape_import;
create policy "software_landscape_delete"
on public.software_landscape_import
for delete
using (auth.uid() is not null);

notify pgrst, 'reload schema';

-- Controlequery
select
  count(*) as totaal,
  count(*) filter (where license_required = true) as licentieplichtig,
  count(*) filter (where license_model is not null and trim(license_model) <> '') as licentiemodel_gevuld,
  count(*) filter (where application_notes is not null and trim(application_notes) <> '') as met_applicatie_opmerking
from public.software_landscape_import;
