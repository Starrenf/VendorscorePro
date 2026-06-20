-- VendorScorePro v0.9.10/v0.9.11 dashboard drilldown + supplier overview support
-- Run this in Supabase SQL editor. Safe to run multiple times.

-- 1) Checklist template compatibility columns used by UI
alter table if exists supplier_checklist_templates
  add column if not exists domain text;

alter table if exists supplier_checklist_templates
  add column if not exists sort_order integer;

update supplier_checklist_templates
set domain = coalesce(domain, 'ICT')
where domain is null;

update supplier_checklist_templates
set sort_order = coalesce(sort_order, 100)
where sort_order is null;

-- 2) Performance review relationship for nested PostgREST selects
alter table if exists supplier_performance_review_items
  drop constraint if exists supplier_performance_review_items_review_id_fkey;

alter table if exists supplier_performance_review_items
  add constraint supplier_performance_review_items_review_id_fkey
  foreign key (review_id)
  references supplier_performance_reviews(id)
  on delete cascade;

-- 3) Risk profile upsert support: one risk profile per supplier per organization
alter table if exists supplier_risk_profiles
  drop constraint if exists supplier_risk_profiles_supplier_unique;

alter table if exists supplier_risk_profiles
  add constraint supplier_risk_profiles_org_supplier_unique
  unique (organization_id, supplier_id);

-- 4) Risk profile RLS policies based on profiles.organization_id
alter table if exists supplier_risk_profiles enable row level security;

drop policy if exists "risk profiles select" on supplier_risk_profiles;
drop policy if exists "risk profiles insert" on supplier_risk_profiles;
drop policy if exists "risk profiles update" on supplier_risk_profiles;
drop policy if exists "risk profiles delete" on supplier_risk_profiles;

create policy "risk profiles select"
on supplier_risk_profiles
for select
to authenticated
using (
  organization_id in (
    select organization_id
    from profiles
    where id = auth.uid()
  )
);

create policy "risk profiles insert"
on supplier_risk_profiles
for insert
to authenticated
with check (
  organization_id in (
    select organization_id
    from profiles
    where id = auth.uid()
  )
);

create policy "risk profiles update"
on supplier_risk_profiles
for update
to authenticated
using (
  organization_id in (
    select organization_id
    from profiles
    where id = auth.uid()
  )
)
with check (
  organization_id in (
    select organization_id
    from profiles
    where id = auth.uid()
  )
);

create policy "risk profiles delete"
on supplier_risk_profiles
for delete
to authenticated
using (
  organization_id in (
    select organization_id
    from profiles
    where id = auth.uid()
  )
);

-- 5) Governance score view. This is the authoritative score source for list/dashboard.
create or replace view supplier_governance_scores as
select
  supplier_id,
  count(*) as total_items,
  count(*) filter (where checked = true) as checked_items,
  round(
    case
      when count(*) = 0 then 0
      else (count(*) filter (where checked = true))::numeric / count(*)::numeric * 100
    end
  )::int as governance_score,
  count(*) filter (where coalesce(nullif(trim(note_text), ''), '') <> '') as notes_count
from governance_checklist_items
group by supplier_id;

-- 6) Supplier overview view for consistent list/dashboard data.
create or replace view supplier_overview_view as
select
  s.id,
  s.organization_id,
  s.name,
  s.classification,
  s.supplier_type,
  s.strategic_type,
  s.category,
  s.status,
  s.is_active,
  s.created_at,
  s.updated_at,
  coalesce(g.total_items, 0) as total_items,
  coalesce(g.checked_items, 0) as checked_items,
  coalesce(g.governance_score, 0) as governance_score,
  coalesce(g.notes_count, 0) as notes_count
from suppliers s
left join supplier_governance_scores g
  on g.supplier_id = s.id
where coalesce(s.is_active, true) = true
  and coalesce(s.status, 'active') <> 'inactive';

-- 7) Refresh PostgREST schema cache.
notify pgrst, 'reload schema';
