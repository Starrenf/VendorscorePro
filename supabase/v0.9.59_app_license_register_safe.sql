-- VendorScorePro v0.9.59
-- Veilige uitbreiding voor Applicatie- & licentieregister.
-- Doel: brondata zelfstandig houden, softwareclassificatie en installatietellingen apart vastleggen.

alter table public.software_landscape_import
add column if not exists software_classification text;

alter table public.software_landscape_import
add column if not exists installation_count integer;

alter table public.software_landscape_import
add column if not exists installation_source text;

alter table public.software_landscape_import
add column if not exists installation_last_check date;

alter table public.software_landscape_import
add column if not exists is_archived boolean default false;

-- Optionele default: alleen vullen waar nog niets staat. Bronkolom application_type blijft ongewijzigd.
update public.software_landscape_import
set software_classification = case
  when lower(trim(coalesce(application_type,''))) in ('burcht', 'stad', 'land', 'schiereiland')
    then initcap(lower(trim(application_type)))
  else coalesce(software_classification, 'Nog niet geclassificeerd')
end
where software_classification is null;

-- Controle-overzicht
select
  count(*) as totaal,
  count(*) filter (where software_classification is not null and software_classification <> 'Nog niet geclassificeerd') as geclassificeerd,
  count(*) filter (where installation_count is not null) as met_installatietelling,
  count(*) filter (where is_archived = true) as gearchiveerd
from public.software_landscape_import;
