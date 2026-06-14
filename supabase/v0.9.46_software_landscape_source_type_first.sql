-- VendorScorePro v0.9.46
-- Softwarelandschap: bronkolom "Type applicatie" is leidend.
-- Deze migratie bewaart de originele importwaarden en gebruikt application_type als primaire weergave-/filterbron.

alter table public.software_landscape_import
  add column if not exists gilde_domain text default 'Nog niet ingedeeld';

alter table public.software_landscape_import
  add column if not exists is_gilde_core boolean default false;

-- Corrigeer alleen de expliciete Gilde-landschapswaarden op basis van de bronkolom Type applicatie.
-- Andere bronwaarden zoals ICT, Kantoorapplicatie, Huisvesting, Landschap, Bedrijfsondersteunend en Koppelingen blijven bewust niet automatisch gemapt.
update public.software_landscape_import
set
  gilde_domain = case
    when lower(trim(application_type)) in ('burcht', 'burght') then 'Burcht'
    when lower(trim(application_type)) = 'stad' then 'Stad'
    when lower(trim(application_type)) = 'land' then 'Land'
    when lower(trim(application_type)) = 'schiereiland' then 'Schiereiland'
    else 'Nog niet ingedeeld'
  end,
  is_gilde_core = case
    when lower(trim(application_type)) in ('burcht', 'burght', 'stad', 'land', 'schiereiland') then true
    else false
  end,
  updated_at = now();

-- Controle: dit moet de originele Type applicatie-verdeling zichtbaar maken.
select application_type, gilde_domain, count(*)
from public.software_landscape_import
group by application_type, gilde_domain
order by application_type, gilde_domain;

notify pgrst, 'reload schema';
