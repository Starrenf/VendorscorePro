-- =====================================================
-- VendorScorePro v0.9.40
-- Match Center, kroonjuweel-engine en rationalisatie/overlapanalyse
-- =====================================================

alter table if exists public.software_landscape_items
  add column if not exists supplier_id uuid,
  add column if not exists owner_name text,
  add column if not exists functional_admin text,
  add column if not exists status text default 'actief',
  add column if not exists source_name text,
  add column if not exists raw_payload jsonb,
  add column if not exists mora_component_id uuid,
  add column if not exists mora_component_name text,
  add column if not exists architecture_source text,
  add column if not exists architecture_relation_status text,
  add column if not exists architecture_relation_note text,
  add column if not exists is_critical boolean not null default false,
  add column if not exists is_overhead boolean not null default false,
  add column if not exists enrichment_status text default 'new';

create index if not exists idx_sli_supplier_id on public.software_landscape_items (supplier_id);
create index if not exists idx_sli_supplier_name on public.software_landscape_items (organization_id, supplier_name);
create index if not exists idx_sli_mora_id on public.software_landscape_items (mora_component_id);
create index if not exists idx_sli_domain on public.software_landscape_items (organization_id, domain);
create index if not exists idx_sli_critical on public.software_landscape_items (is_critical);
create index if not exists idx_sli_overhead on public.software_landscape_items (is_overhead);

-- Match-/rationalisatie-view voor controles en dashboards.
drop view if exists public.v_software_landscape_match_center;
create view public.v_software_landscape_match_center as
select
  sli.id,
  sli.organization_id,
  sli.application_name,
  sli.application_type,
  sli.description,
  sli.supplier_id,
  sli.supplier_name,
  sli.domain,
  sli.functional_admin,
  sli.key_user,
  sli.is_critical,
  sli.is_overhead,
  sli.status,
  sli.mora_component_id,
  coalesce(sli.mora_component_name, mac.name) as mora_component_name,
  mac.mora_type,
  mac.specialization,
  sli.architecture_relation_status,
  sli.architecture_relation_note,
  sli.enrichment_status,
  case
    when sli.is_overhead then 'overhead-uitgesloten'
    when sli.supplier_id is not null or nullif(sli.supplier_name, '') is not null then 'leverancier-gekoppeld'
    else 'leverancier-ontbreekt'
  end as supplier_match_status,
  case
    when sli.is_overhead then 'overhead-uitgesloten'
    when sli.mora_component_id is not null then 'architectuur-gekoppeld'
    when mac.id is not null then 'naam-match-mogelijk'
    else 'architectuur-ontbreekt'
  end as architecture_match_status,
  case
    when sli.is_overhead then 'Niet meenemen in governance'
    when sli.is_critical then 'Kroonjuweel: governance prioriteit hoog'
    when sli.supplier_id is null and nullif(sli.supplier_name, '') is null then 'Leverancier koppelen'
    when sli.mora_component_id is null then 'Architectuurkoppeling beoordelen'
    else 'Verrijkt'
  end as recommended_action
from public.software_landscape_items sli
left join public.mora_application_components mac
  on mac.organization_id = sli.organization_id
 and (
   mac.id = sli.mora_component_id
   or lower(trim(mac.name)) = lower(trim(sli.application_name))
 );

grant select on public.v_software_landscape_match_center to authenticated;

-- Overlap/rationalisatie per domein/type.
drop view if exists public.v_software_landscape_overlap_summary;
create view public.v_software_landscape_overlap_summary as
select
  organization_id,
  coalesce(nullif(domain, ''), nullif(application_type, ''), 'Onbekend') as overlap_group,
  count(*) as application_count,
  count(*) filter (where is_critical) as critical_count,
  count(*) filter (where supplier_id is not null or nullif(supplier_name, '') is not null) as supplier_linked_count,
  count(*) filter (where mora_component_id is not null or nullif(mora_component_name, '') is not null) as architecture_linked_count
from public.software_landscape_items
where coalesce(is_overhead, false) = false
  and deleted_at is null
group by organization_id, coalesce(nullif(domain, ''), nullif(application_type, ''), 'Onbekend')
having count(*) >= 3;

grant select on public.v_software_landscape_overlap_summary to authenticated;

notify pgrst, 'reload schema';
