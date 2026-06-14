# VendorScorePro v0.9.14 – Applicatie-details & contractsamenvatting

## Nieuw
- Applicatiekaarten in **Applicaties & functioneel beheer** zijn klikbaar gemaakt.
- Na klikken opent een duidelijke applicatie-detailsectie onder het applicatieoverzicht.
- Contractsamenvatting is nu zichtbaar via:
  **Leverancier → Applicaties & beheer → klik applicatie → Applicatie-detail → Contractsamenvatting**.
- Applicatie-detail toont status, kroonjuweel-indicatie, aantal functioneel-beheerrecords en omschrijving.

## Supabase
- Nieuwe migratie toegevoegd:
  `supabase/v0.9.14_application_contract_summaries.sql`
- Bevat tabel `application_contract_summaries`, indexes, full-text search vector, RLS policies en updated_at trigger.

## Build
- `npm run build` succesvol uitgevoerd.
- Alleen bekende Vite chunk-size waarschuwing.
