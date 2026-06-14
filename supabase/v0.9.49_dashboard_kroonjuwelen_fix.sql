-- v0.9.49 Dashboard kroonjuwelen fix
-- Geen databasewijziging vereist.
-- De frontend telt kroonjuwelen nu uitsluitend uit bestaande VendorScorePro-applicaties
-- die kritisch zijn gemarkeerd én een functioneel-beheerregistratie hebben.
-- software_landscape_import wordt hierbij expliciet niet gebruikt.

-- Optionele controlequery: applicaties die mogelijk als kroonjuweel meetellen
select
  a.id,
  a.name,
  a.supplier_id,
  a.is_critical,
  coalesce(f.contact_name, f.application_name) as functioneel_beheer
from public.applications a
join public.functional_admin_assignments f
  on (
    f.application_id = a.id
    or (
      f.supplier_id = a.supplier_id
      and lower(trim(f.application_name)) = lower(trim(a.name))
    )
  )
where coalesce(a.is_critical, false) = true
order by a.name;
