# VendorScorePro v0.9.8 – Suppliers Overview Governance Fix

## Doel
Deze patch zorgt ervoor dat het leveranciersoverzicht dezelfde governance-score gebruikt als de detailpagina.

## Aangepast
- `src/pages/Suppliers.jsx`
  - Query gebruikt nu `supplier_overview_view` in plaats van direct `suppliers`.
  - Governancepercentage komt dynamisch uit `governance_checklist_items` via de view.
  - Badge toont nu optioneel ook `checked/total`, bijvoorbeeld `Governance 91% (20/22)`.

## Toegevoegd
- `supabase/migrations/20260424_supplier_overview_view.sql`
  - Maakt/actualiseert `supplier_governance_scores`.
  - Maakt/actualiseert `supplier_overview_view`.
  - Filtert alleen actieve leveranciers.

## Belangrijk
Voer de SQL-migratie uit in Supabase of plak de inhoud van het migratiebestand in de SQL-editor.
Daarna hard refreshen met `Ctrl + F5`.
