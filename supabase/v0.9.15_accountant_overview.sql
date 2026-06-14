-- =====================================================
-- VendorScorePro v0.9.15
-- Accountant-overzicht per leverancier + dashboard compatibility
-- =====================================================

alter table suppliers
add column if not exists supplier_type text default 'leverancier';

-- Herbouw single-source governance summary met stabiele frontend-kolommen.
drop view if exists supplier_accountant_overview_view cascade;
drop view if exists supplier_overview_view cascade;
drop view if exists supplier_governance_summary cascade;

create or replace view supplier_governance_summary as
select
  supplier_id,
  organization_id,
  count(*) as total_items,
  count(*) filter (where checked = true) as checked_items,
  round(
    case
      when count(*) = 0 then 0
      else (count(*) filter (where checked = true)::numeric / count(*)::numeric) * 100
    end
  )::int as score_percent,
  case
    when count(*) = 0 then 'Niet gestart'
    when ((count(*) filter (where checked = true)::numeric / count(*)::numeric) * 100) >= 75 then 'Groen'
    when ((count(*) filter (where checked = true)::numeric / count(*)::numeric) * 100) >= 50 then 'Oranje'
    else 'Rood'
  end as status_label,
  case
    when count(*) = 0 then 'gray'
    when ((count(*) filter (where checked = true)::numeric / count(*)::numeric) * 100) >= 75 then 'green'
    when ((count(*) filter (where checked = true)::numeric / count(*)::numeric) * 100) >= 50 then 'orange'
    else 'red'
  end as status_color
from governance_checklist_items
group by supplier_id, organization_id;

create or replace view supplier_overview_view as
select
  s.id,
  s.organization_id,
  s.name,
  s.status,
  s.category,
  s.classification,
  s.supplier_type,
  s.is_active,
  s.created_at,
  s.updated_at,

  coalesce(g.total_items, 0) as governance_total_items,
  coalesce(g.checked_items, 0) as governance_checked_items,
  coalesce(g.total_items, 0) as total_items,
  coalesce(g.checked_items, 0) as checked_items,
  coalesce(g.score_percent, 0) as governance_score_percent,
  coalesce(g.score_percent, 0) as governance_score,
  coalesce(g.status_label, 'Niet gestart') as governance_status_label,
  coalesce(g.status_color, 'gray') as governance_status,
  coalesce(g.status_color, 'gray') as governance_status_color,

  -- compatibility fields for older dashboard components
  0 as notes_count,
  0 as open_actions_count,
  0 as documents_count,
  0 as applications_count,
  0 as ai_subprocessors_count
from suppliers s
left join supplier_governance_summary g
  on g.supplier_id = s.id
 and g.organization_id = s.organization_id;

-- Accountant view: 1 rij per leverancier, met aantallen/statussen voor export.
create or replace view supplier_accountant_overview_view as
select
  s.id,
  s.organization_id,
  s.name,
  s.kvk_number,
  s.creditor_number,
  s.category,
  s.classification,
  s.status,
  s.is_active,
  s.created_at,
  s.updated_at,

  coalesce(g.total_items, 0) as total_items,
  coalesce(g.checked_items, 0) as checked_items,
  coalesce(g.score_percent, 0) as governance_score,
  coalesce(g.status_label, 'Niet gestart') as governance_status_label,
  coalesce(g.status_color, 'gray') as governance_status_color,

  coalesce((select count(*) from supplier_contracts c where c.supplier_id = s.id and c.organization_id = s.organization_id), 0) as contracts_count,
  coalesce((select count(*) from applications a where a.supplier_id = s.id and a.organization_id = s.organization_id), 0) as applications_count,
  coalesce((select count(*) from supplier_documents d where d.supplier_id = s.id and d.organization_id = s.organization_id), 0) as documents_count,
  coalesce((select count(*) from subprocessors sp where sp.supplier_id = s.id and sp.organization_id = s.organization_id), 0) as subprocessors_count,
  coalesce((select count(*) from supplier_actions ac where ac.supplier_id = s.id and ac.organization_id = s.organization_id and coalesce(lower(ac.status), 'open') <> 'afgerond'), 0) as open_actions_count,
  coalesce((select count(*) from supplier_meetings m where m.supplier_id = s.id and m.organization_id = s.organization_id), 0) as meetings_count,

  (select max(m.meeting_date) from supplier_meetings m where m.supplier_id = s.id and m.organization_id = s.organization_id) as latest_meeting_date,
  (select max(acs.updated_at) from application_contract_summaries acs where acs.organization_id = s.organization_id and acs.supplier_id = s.id) as latest_contract_summary_updated_at
from suppliers s
left join supplier_governance_summary g
  on g.supplier_id = s.id
 and g.organization_id = s.organization_id;

-- RLS blijft via onderliggende tabellen/policies lopen. Views worden bewust zonder security definer aangemaakt.
