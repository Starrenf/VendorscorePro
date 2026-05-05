-- Supplier overview view
-- Doel: leverancierslijst en dashboard dezelfde governance-score laten gebruiken als de detailpagina.
-- De score wordt dynamisch berekend uit governance_checklist_items.

create or replace view public.supplier_governance_scores as
select
  supplier_id,
  count(*) as total_items,
  count(*) filter (where checked = true) as checked_items,
  round(
    case
      when count(*) = 0 then 0
      else (count(*) filter (where checked = true))::numeric / count(*)::numeric * 100
    end
  )::int as governance_score
from public.governance_checklist_items
group by supplier_id;

create or replace view public.supplier_overview_view as
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
  0::int as notes_count
from public.suppliers s
left join public.supplier_governance_scores g
  on g.supplier_id = s.id
where s.is_active = true
  and s.status = 'active';

notify pgrst, 'reload schema';
