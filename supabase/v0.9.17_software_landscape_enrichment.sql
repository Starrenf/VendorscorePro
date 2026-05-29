-- =====================================================
-- VendorScorePro v0.9.17
-- Softwarelandschap verrijken vanuit staging-import
-- =====================================================

-- 1. Staging tabel verrijkbaar maken als deze via los importscript is aangemaakt.
alter table if exists public.software_landscape_import
  add column if not exists supplier_name text,
  add column if not exists owner_name text,
  add column if not exists functional_admin text,
  add column if not exists is_critical boolean default false,
  add column if not exists suggested_category text,
  add column if not exists suggested_supplier_name text,
  add column if not exists is_overhead boolean default false,
  add column if not exists import_status text default 'new',
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_software_landscape_import_org
  on public.software_landscape_import (organization_id);

create index if not exists idx_software_landscape_import_app
  on public.software_landscape_import (application_name);

-- 2. Definitief softwarelandschap uitbreiden met bronvelden uit Applicatie Portfolio.
alter table if exists public.software_landscape_items
  add column if not exists application_type text,
  add column if not exists description text,
  add column if not exists manual_url text,
  add column if not exists didactic_component text,
  add column if not exists main_functions text,
  add column if not exists licenses text,
  add column if not exists key_user text,
  add column if not exists is_overhead boolean not null default false,
  add column if not exists enrichment_status text default 'new';

create index if not exists idx_software_landscape_items_overhead
  on public.software_landscape_items (is_overhead);

create index if not exists idx_software_landscape_items_enrichment_status
  on public.software_landscape_items (enrichment_status);

-- 3. Applications tabel geschikt maken voor koppeling vanuit softwarelandschap.
alter table if exists public.applications
  add column if not exists functional_owner text,
  add column if not exists is_critical boolean not null default false;

-- 4. Definitieve match-view opnieuw opbouwen.
drop view if exists public.software_landscape_match_view;

create view public.software_landscape_match_view as
select
  sli.*,
  s.id as matched_supplier_id,
  s.name as matched_supplier_name,
  a.id as matched_application_id,
  a.name as matched_application_name,
  case
    when a.id is not null and s.id is not null then 'volledige-match'
    when a.id is not null then 'applicatie-match'
    when s.id is not null then 'leverancier-match'
    else 'geen-match'
  end as match_status,
  case
    when sli.is_overhead then 'uitsluiten-van-governance'
    when sli.is_critical then 'kroonjuweel-kandidaat'
    when s.id is null then 'leverancier-koppelen'
    else 'verrijkt'
  end as governance_action
from public.software_landscape_items sli
left join public.suppliers s
  on s.organization_id = sli.organization_id
 and lower(trim(s.name)) = lower(trim(sli.supplier_name))
left join public.applications a
  on a.organization_id = sli.organization_id
 and lower(trim(a.name)) = lower(trim(sli.application_name));

grant select on public.software_landscape_match_view to authenticated;
notify pgrst, 'reload schema';
