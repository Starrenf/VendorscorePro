-- =====================================================
-- VendorScorePro v0.9.16
-- Documentlinks i.p.v. upload + softwarelandschap import
-- =====================================================

-- 1. Documenten: primair Teams/SharePoint linkregistratie.
alter table if exists public.supplier_documents
  add column if not exists external_url text,
  add column if not exists storage_mode text not null default 'link',
  add column if not exists source_system text default 'Teams/SharePoint',
  add column if not exists version text,
  add column if not exists owner_name text,
  add column if not exists sensitivity text default 'Intern';

update public.supplier_documents
set
  external_url = coalesce(external_url, document_url),
  storage_mode = coalesce(storage_mode, 'link'),
  source_system = coalesce(source_system, storage_provider, 'Teams/SharePoint')
where true;

create index if not exists idx_supplier_documents_external_url
  on public.supplier_documents (external_url);

create index if not exists idx_supplier_documents_storage_mode
  on public.supplier_documents (storage_mode);

-- 2. Softwarelandschap: referentiebron voor applicaties, leveranciers en uploads van derden.
create table if not exists public.software_landscape_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  application_name text not null,
  supplier_name text,
  domain text,
  owner_name text,
  functional_admin text,
  is_critical boolean not null default false,
  status text default 'actief',
  source_name text default 'Softwarelandschap import',
  raw_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists software_landscape_org_application_unique
  on public.software_landscape_items (organization_id, application_name);

create index if not exists idx_software_landscape_org
  on public.software_landscape_items (organization_id);

create index if not exists idx_software_landscape_supplier
  on public.software_landscape_items (supplier_name);

create index if not exists idx_software_landscape_domain
  on public.software_landscape_items (domain);

alter table public.software_landscape_items enable row level security;

drop policy if exists "software_landscape_select_own_org" on public.software_landscape_items;
create policy "software_landscape_select_own_org"
on public.software_landscape_items
for select
to authenticated
using (
  organization_id = public.current_org_id()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = software_landscape_items.organization_id
  )
);

drop policy if exists "software_landscape_insert_own_org" on public.software_landscape_items;
create policy "software_landscape_insert_own_org"
on public.software_landscape_items
for insert
to authenticated
with check (
  organization_id = public.current_org_id()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = software_landscape_items.organization_id
  )
);

drop policy if exists "software_landscape_update_own_org" on public.software_landscape_items;
create policy "software_landscape_update_own_org"
on public.software_landscape_items
for update
to authenticated
using (
  organization_id = public.current_org_id()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = software_landscape_items.organization_id
  )
)
with check (
  organization_id = public.current_org_id()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = software_landscape_items.organization_id
  )
);

drop policy if exists "software_landscape_delete_own_org" on public.software_landscape_items;
create policy "software_landscape_delete_own_org"
on public.software_landscape_items
for delete
to authenticated
using (
  organization_id = public.current_org_id()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = software_landscape_items.organization_id
  )
);

-- 3. View voor toekomstige verrijking/matching met leveranciers en applicaties.
create or replace view public.software_landscape_match_view as
select
  sli.*,
  s.id as matched_supplier_id,
  s.name as matched_supplier_name,
  a.id as matched_application_id,
  a.name as matched_application_name,
  case
    when a.id is not null then 'applicatie-match'
    when s.id is not null then 'leverancier-match'
    else 'geen-match'
  end as match_status
from public.software_landscape_items sli
left join public.suppliers s
  on s.organization_id = sli.organization_id
 and lower(trim(s.name)) = lower(trim(sli.supplier_name))
left join public.applications a
  on a.organization_id = sli.organization_id
 and lower(trim(a.name)) = lower(trim(sli.application_name));

grant select on public.software_landscape_match_view to authenticated;
notify pgrst, 'reload schema';
