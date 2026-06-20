# VendorScorePro v0.9.68 – Kroonjuwelen Dashboard Tiles

## Doel
Eerste versie van de openingspagina met klikbare kroonjuwelen-tegels.

## Toegevoegd
- Nieuwe component `CrownJewelsTiles`.
- Homepage toont digitale kroonjuwelen als logo-/snelkoppelingtegels.
- Tegels ondersteunen:
  - titel
  - omschrijving
  - logo URL
  - externe applicatie-/website URL
  - governance score
  - risiconiveau
  - sortering
- Placeholder-initialen wanneer nog geen logo is ingevuld.
- Waarschuwing wanneer SQL-migratie `dashboard_tiles` nog niet is uitgevoerd.

## Database
Nieuwe tabel:
- `public.dashboard_tiles`

Migratie:
- `supabase/v0.9.68_crown_jewels_dashboard_tiles.sql`

## Ontwerpkeuze
De tegels zijn bewust los gekoppeld van leveranciers/applicaties zodat de eerste versie veilig is en morgen eenvoudig met echte logo's en URL's gevuld kan worden.

## Geen impact op
- leveranciersregister
- applicatieregister
- AI-register
- governance
- contracten
- RLS bestaande tabellen
