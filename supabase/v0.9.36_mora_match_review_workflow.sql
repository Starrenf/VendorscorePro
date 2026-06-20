-- =====================================================
-- VendorScorePro v0.9.36
-- MORA Match Review Workflow
-- Doel: architect/functioneel beheer kan MORA matches bevestigen, afwijzen,
-- handmatig koppelen, markeren als technisch component of uitsluiten.
-- =====================================================

create table if not exists public.mora_application_component_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  mora_component_id uuid references public.mora_application_components(id) on delete cascade,
  application_id uuid,
  match_score numeric,
  match_status text default 'candidate',
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.mora_application_component_matches
add column if not exists reviewed_by uuid,
add column if not exists reviewed_at timestamptz,
add column if not exists notes text,
add column if not exists updated_at timestamptz default now();

alter table public.mora_application_component_matches
add constraint mora_application_component_matches_status_check
check (match_status in ('candidate','confirmed','rejected','manual','technical','excluded'))
not valid;

-- Unieke match per MORA-component/applicatie/organisatie, nodig voor frontend upsert.
create unique index if not exists mora_component_matches_org_component_app_unique
on public.mora_application_component_matches (organization_id, mora_component_id, application_id);

alter table public.mora_application_component_matches enable row level security;

drop policy if exists "mora_matches_select_org" on public.mora_application_component_matches;
drop policy if exists "mora_matches_insert_org" on public.mora_application_component_matches;
drop policy if exists "mora_matches_update_org" on public.mora_application_component_matches;
drop policy if exists "mora_matches_delete_admin" on public.mora_application_component_matches;

create policy "mora_matches_select_org"
on public.mora_application_component_matches
for select
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "mora_matches_insert_org"
on public.mora_application_component_matches
for insert
to authenticated
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "mora_matches_update_org"
on public.mora_application_component_matches
for update
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
)
with check (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "mora_matches_delete_admin"
on public.mora_application_component_matches
for delete
to authenticated
using (
  organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
    and coalesce(role, '') in ('admin','owner')
  )
);

-- View met reviewstatus, handig voor dashboards en rapportages.
create or replace view public.v_mora_application_match_review as
select
  c.organization_id,
  c.mora_component_id,
  c.mora_element_id,
  c.mora_application_name,
  c.application_id,
  c.vendorscore_application_name,
  c.match_score,
  c.match_type,
  coalesce(m.match_status, 'open') as review_status,
  m.reviewed_by,
  m.reviewed_at,
  m.notes,
  m.id as match_review_id
from public.v_mora_application_match_candidates c
left join public.mora_application_component_matches m
  on m.organization_id = c.organization_id
 and m.mora_component_id = c.mora_component_id
 and m.application_id = c.application_id;

create or replace view public.v_mora_application_match_review_summary as
select
  organization_id,
  review_status,
  count(*) as total
from public.v_mora_application_match_review
group by organization_id, review_status;

-- Controle:
-- select * from public.v_mora_application_match_review order by match_score desc limit 50;
-- select * from public.v_mora_application_match_review_summary;
