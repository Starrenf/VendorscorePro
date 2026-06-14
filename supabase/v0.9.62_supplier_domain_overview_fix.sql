-- VendorScorePro v0.9.62
-- Fix: supplier_overview_view bevat expliciet domain zodat leveranciersoverzicht hetzelfde domein toont als detailpagina.

drop view if exists public.supplier_overview_view;

create view public.supplier_overview_view as
select
    s.id,
    s.organization_id,
    s.name,
    s.status,
    s.category,
    s.classification,
    coalesce(nullif(s.domain,''),'Generiek') as domain,
    coalesce(s.supplier_type,'leverancier') as supplier_type,
    s.is_active,
    s.created_at,
    s.updated_at,
    coalesce(g.total_items,0::bigint) as governance_total_items,
    coalesce(g.checked_items,0::bigint) as governance_checked_items,
    coalesce(g.total_items,0::bigint) as total_items,
    coalesce(g.checked_items,0::bigint) as checked_items,
    coalesce(g.score_percent,0) as governance_score_percent,
    coalesce(g.score_percent,0) as governance_score,
    coalesce(g.status_label,'Niet gestart') as governance_status_label,
    coalesce(g.status_color,'gray') as governance_status,
    coalesce(g.status_color,'gray') as governance_status_color,
    0 as notes_count,
    0 as open_actions_count,
    0 as documents_count,
    0 as applications_count,
    0 as ai_subprocessors_count
from public.suppliers s
left join public.supplier_governance_summary g
    on g.supplier_id = s.id
   and g.organization_id = s.organization_id
where coalesce(s.is_active,true) = true
  and coalesce(s.status,'active') <> all(array['archived','deleted']);

notify pgrst, 'reload schema';
