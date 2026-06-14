-- =====================================================
-- VendorScorePro v0.9.19
-- Softwarelandschap: CRUD + relatie met MORA / Frank v.G.-architectuurlijst
-- =====================================================

-- 1. Definitief softwarelandschap uitbreiden met relatievelden.
alter table if exists public.software_landscape_items
  add column if not exists mora_component_id uuid,
  add column if not exists mora_component_name text,
  add column if not exists architecture_source text,
  add column if not exists architecture_relation_status text default 'niet-gekoppeld',
  add column if not exists architecture_relation_note text,
  add column if not exists lifecycle_status text default 'actief',
  add column if not exists deleted_at timestamptz;

create index if not exists idx_software_landscape_mora_component
  on public.software_landscape_items (mora_component_id);

create index if not exists idx_software_landscape_architecture_status
  on public.software_landscape_items (architecture_relation_status);

-- 2. Optionele relationele audit-tabel: bruikbaar wanneer later meerdere relaties per applicatie nodig zijn.
create table if not exists public.software_landscape_architecture_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  software_landscape_item_id uuid not null references public.software_landscape_items(id) on delete cascade,
  mora_component_id uuid,
  mora_component_name text,
  relation_type text default 'maps_to',
  relation_status text default 'gekoppeld',
  confidence_score int,
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sli_arch_links_org
  on public.software_landscape_architecture_links (organization_id);

create index if not exists idx_sli_arch_links_item
  on public.software_landscape_architecture_links (software_landscape_item_id);

create index if not exists idx_sli_arch_links_mora
  on public.software_landscape_architecture_links (mora_component_id);

alter table public.software_landscape_architecture_links enable row level security;

drop policy if exists "software_landscape_arch_links_select" on public.software_landscape_architecture_links;
create policy "software_landscape_arch_links_select"
on public.software_landscape_architecture_links
for select
to authenticated
using (
  organization_id = public.current_org_id()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = software_landscape_architecture_links.organization_id
  )
);

drop policy if exists "software_landscape_arch_links_insert" on public.software_landscape_architecture_links;
create policy "software_landscape_arch_links_insert"
on public.software_landscape_architecture_links
for insert
to authenticated
with check (
  organization_id = public.current_org_id()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = software_landscape_architecture_links.organization_id
  )
);

drop policy if exists "software_landscape_arch_links_update" on public.software_landscape_architecture_links;
create policy "software_landscape_arch_links_update"
on public.software_landscape_architecture_links
for update
to authenticated
using (
  organization_id = public.current_org_id()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = software_landscape_architecture_links.organization_id
  )
)
with check (
  organization_id = public.current_org_id()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = software_landscape_architecture_links.organization_id
  )
);

drop policy if exists "software_landscape_arch_links_delete" on public.software_landscape_architecture_links;
create policy "software_landscape_arch_links_delete"
on public.software_landscape_architecture_links
for delete
to authenticated
using (
  organization_id = public.current_org_id()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = software_landscape_architecture_links.organization_id
  )
);

-- 3. View voor controle: Gilde softwarelandschap met architectuurkoppeling.
drop view if exists public.v_software_landscape_architecture_coverage;
create view public.v_software_landscape_architecture_coverage as
select
  sli.id,
  sli.organization_id,
  sli.application_name,
  sli.application_type,
  sli.supplier_name,
  sli.domain,
  sli.functional_admin,
  sli.is_critical,
  sli.is_overhead,
  sli.status,
  sli.mora_component_id,
  coalesce(sli.mora_component_name, mac.name) as mora_component_name,
  mac.mora_type,
  mac.specialization,
  case
    when sli.is_overhead then 'overhead-uitgesloten'
    when sli.mora_component_id is not null then 'gekoppeld'
    when mac.id is not null then 'naam-match-mogelijk'
    else 'niet-gekoppeld'
  end as architecture_coverage_status,
  sli.architecture_relation_note,
  sli.updated_at
from public.software_landscape_items sli
left join public.mora_application_components mac
  on mac.organization_id = sli.organization_id
 and (
   mac.id = sli.mora_component_id
   or lower(trim(mac.name)) = lower(trim(sli.application_name))
 );

grant select on public.v_software_landscape_architecture_coverage to authenticated;

notify pgrst, 'reload schema';
