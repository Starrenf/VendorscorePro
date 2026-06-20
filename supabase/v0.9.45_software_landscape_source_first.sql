-- VendorScorePro v0.9.45
-- Softwarelandschap: bronkolom application_type is leidend voor Gilde landschapsdomein.
-- Geen regex/automatische overschrijving op basis van omschrijving of naam.

alter table if exists public.software_landscape_import
add column if not exists gilde_domain text default 'Nog niet ingedeeld';

alter table if exists public.software_landscape_import
add column if not exists is_gilde_core boolean default false;

alter table if exists public.software_landscape_items
add column if not exists gilde_domain text default 'Nog niet ingedeeld';

alter table if exists public.applications
add column if not exists gilde_domain text default 'Nog niet ingedeeld';

alter table if exists public.applications
add column if not exists is_gilde_landscape boolean default true;

-- Eerst expliciete bronwaarden 1-op-1 normaliseren.
update public.software_landscape_import
set
  gilde_domain = case
    when lower(trim(coalesce(application_type,''))) in ('burcht', 'burght') then 'Burcht'
    when lower(trim(coalesce(application_type,''))) = 'stad' then 'Stad'
    when lower(trim(coalesce(application_type,''))) = 'land' then 'Land'
    when lower(trim(coalesce(application_type,''))) = 'schiereiland' then 'Schiereiland'
    else 'Nog niet ingedeeld'
  end,
  is_gilde_core = case
    when lower(trim(coalesce(application_type,''))) in ('burcht', 'burght', 'stad', 'land', 'schiereiland') then true
    else false
  end,
  updated_at = now();

-- Als er al verwerkte landschap-items zijn, zet alleen expliciete bronwaarden goed.
update public.software_landscape_items
set
  gilde_domain = case
    when lower(trim(coalesce(application_type,''))) in ('burcht', 'burght') then 'Burcht'
    when lower(trim(coalesce(application_type,''))) = 'stad' then 'Stad'
    when lower(trim(coalesce(application_type,''))) = 'land' then 'Land'
    when lower(trim(coalesce(application_type,''))) = 'schiereiland' then 'Schiereiland'
    else coalesce(gilde_domain, 'Nog niet ingedeeld')
  end,
  updated_at = now()
where application_type is not null;

notify pgrst, 'reload schema';
