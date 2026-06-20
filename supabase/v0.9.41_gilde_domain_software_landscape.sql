-- =====================================================
-- VendorScorePro v0.9.41
-- Gilde-domeinen zichtbaar maken in Softwarelandschap
-- Doel: applicaties herkenbaar filteren op Burght, Stad, Land en Schiereiland.
-- =====================================================

alter table if exists public.software_landscape_import
  add column if not exists gilde_domain text default 'Nog niet ingedeeld',
  add column if not exists is_gilde_landscape boolean default true;

alter table if exists public.software_landscape_items
  add column if not exists gilde_domain text default 'Nog niet ingedeeld',
  add column if not exists is_gilde_landscape boolean default true;

alter table if exists public.applications
  add column if not exists gilde_domain text default 'Nog niet ingedeeld',
  add column if not exists is_gilde_landscape boolean default true;

create index if not exists idx_sli_gilde_domain
  on public.software_landscape_items (organization_id, gilde_domain);

create index if not exists idx_sli_is_gilde_landscape
  on public.software_landscape_items (organization_id, is_gilde_landscape);

create index if not exists idx_software_import_gilde_domain
  on public.software_landscape_import (organization_id, gilde_domain);

create index if not exists idx_applications_gilde_domain
  on public.applications (organization_id, gilde_domain);

-- Vul bestaande items voorzichtig met een voorstel als ze nog niet ingedeeld zijn.
update public.software_landscape_items
set gilde_domain = case
  when lower(coalesce(application_name,'') || ' ' || coalesce(application_type,'') || ' ' || coalesce(description,'') || ' ' || coalesce(domain,'')) ~ '(eduarte|canvas|xedule|magister|itslearning|lms|student|rooster|examen|onderwijs|didact)' then 'Stad'
  when lower(coalesce(application_name,'') || ' ' || coalesce(application_type,'') || ' ' || coalesce(description,'') || ' ' || coalesce(domain,'')) ~ '(afas|finance|financi|hr|personeel|inkoop|factuur|salaris|debiteur|crediteur)' then 'Land'
  when lower(coalesce(application_name,'') || ' ' || coalesce(application_type,'') || ' ' || coalesce(description,'') || ' ' || coalesce(domain,'')) ~ '(microsoft|azure|entra|office|teams|sharepoint|defender|identity|iam|sso|mfa|netwerk|firewall|security|backup|server|topdesk|intune)' then 'Burght'
  when lower(coalesce(application_name,'') || ' ' || coalesce(application_type,'') || ' ' || coalesce(description,'') || ' ' || coalesce(domain,'')) ~ '(vendorscore|contract|leverancier|governance|privacy|avg|audit|signhost|decos|document|servicedesk|facilitair)' then 'Schiereiland'
  else coalesce(gilde_domain, 'Nog niet ingedeeld')
end,
updated_at = now()
where coalesce(gilde_domain, 'Nog niet ingedeeld') = 'Nog niet ingedeeld';

update public.software_landscape_import
set gilde_domain = case
  when lower(coalesce(application_name,'') || ' ' || coalesce(application_type,'') || ' ' || coalesce(description,'') || ' ' || coalesce(suggested_category,'')) ~ '(eduarte|canvas|xedule|magister|itslearning|lms|student|rooster|examen|onderwijs|didact)' then 'Stad'
  when lower(coalesce(application_name,'') || ' ' || coalesce(application_type,'') || ' ' || coalesce(description,'') || ' ' || coalesce(suggested_category,'')) ~ '(afas|finance|financi|hr|personeel|inkoop|factuur|salaris|debiteur|crediteur)' then 'Land'
  when lower(coalesce(application_name,'') || ' ' || coalesce(application_type,'') || ' ' || coalesce(description,'') || ' ' || coalesce(suggested_category,'')) ~ '(microsoft|azure|entra|office|teams|sharepoint|defender|identity|iam|sso|mfa|netwerk|firewall|security|backup|server|topdesk|intune)' then 'Burght'
  when lower(coalesce(application_name,'') || ' ' || coalesce(application_type,'') || ' ' || coalesce(description,'') || ' ' || coalesce(suggested_category,'')) ~ '(vendorscore|contract|leverancier|governance|privacy|avg|audit|signhost|decos|document|servicedesk|facilitair)' then 'Schiereiland'
  else coalesce(gilde_domain, 'Nog niet ingedeeld')
end,
updated_at = now()
where coalesce(gilde_domain, 'Nog niet ingedeeld') = 'Nog niet ingedeeld';

-- Overhead wordt standaard niet als Gilde-landschap gemarkeerd.
update public.software_landscape_items
set is_gilde_landscape = false,
    updated_at = now()
where coalesce(is_overhead, false) = true;

-- Compatibele analyseview per Gilde-domein.
drop view if exists public.v_software_landscape_gilde_domain_summary;
create view public.v_software_landscape_gilde_domain_summary as
select
  organization_id,
  coalesce(nullif(gilde_domain, ''), 'Nog niet ingedeeld') as gilde_domain,
  count(*) as application_count,
  count(*) filter (where coalesce(is_gilde_landscape, true) = true and coalesce(is_overhead, false) = false) as gilde_landscape_count,
  count(*) filter (where coalesce(is_critical, false) = true) as critical_count,
  count(*) filter (where coalesce(is_overhead, false) = true) as overhead_count,
  count(*) filter (where supplier_id is not null or nullif(supplier_name, '') is not null) as supplier_linked_count
from public.software_landscape_items
group by organization_id, coalesce(nullif(gilde_domain, ''), 'Nog niet ingedeeld');

grant select on public.v_software_landscape_gilde_domain_summary to authenticated;
grant select on public.software_landscape_items to authenticated;
grant select, update on public.software_landscape_import to authenticated;

notify pgrst, 'reload schema';
