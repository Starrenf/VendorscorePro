# VendorScorePro v0.9.70 - Kroonjuwelenbeheer

## Toegevoegd
- Beheerblok voor kroonjuwelen in Instellingen.
- Tegels toevoegen, wijzigen en verwijderen vanuit de applicatie.
- Beheer van titel, omschrijving, logo-pad, doel-URL, volgorde, actief/inactief en kroonjuweelstatus.
- Logo-preview en directe Open URL-knop.

## Database / security
- SQL-migratie voor `dashboard_tiles` uitgebreid met ontbrekende kolommen.
- Foreign keys naar `suppliers` en `applications` toegevoegd.
- RLS policies voor eigen organisatie toegevoegd.
- Anon-toegang op `dashboard_tiles` ingetrokken.

## Bestand
- `supabase/v0.9.70_crown_jewels_admin_security.sql`
