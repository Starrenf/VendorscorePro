-- VendorScorePro v0.9.33 Architect View reference
-- Deze build gebruikt bestaande tabellen/views uit v0.9.30:
-- mora_application_components
-- mora_application_component_properties
-- mora_application_component_matches
-- v_mora_application_match_candidates
-- v_mora_application_components_with_biv
-- architecture_domains
-- architecture_relations
-- v_architecture_domain_overview
-- v_architecture_relation_type_summary

-- Controlequeries:
select count(*) as mora_components from public.mora_application_components;
select count(*) as architecture_relations from public.architecture_relations;
select count(*) as architecture_domains from public.architecture_domains;
select * from public.v_mora_application_match_candidates order by match_score desc limit 25;
