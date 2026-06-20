-- VendorScorePro v0.9.27 Architectuur Cockpit reference
-- Deze build verwacht dat de MORA import uit v0.9.26 is uitgevoerd.

-- Controle MORA componenten:
select count(*) as mora_components
from public.mora_application_components;

-- Controle properties:
select count(*) as mora_properties
from public.mora_application_component_properties;

-- Controle match-kandidaten:
select *
from public.v_mora_application_match_candidates
order by match_score desc
limit 50;

-- Controle BIV overzicht:
select *
from public.v_mora_application_components_with_biv
order by name
limit 50;

-- Documentupload test:
-- Verwacht: Storage bucket supplier-documents + tabel supplier_documents.
select *
from public.supplier_documents
limit 10;
