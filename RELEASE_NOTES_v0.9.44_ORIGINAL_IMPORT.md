# VendorScorePro v0.9.44 - Softwarelandschap originele import

## Doel
Het softwarelandschap wordt eerst 1-op-1 weergegeven zoals het CSV-bestand is geïmporteerd. Verrijking is apart gezet zodat brondata en interpretatie niet door elkaar lopen.

## Frontend
- Nieuwe tab **Originele import** als startweergave.
- Toont exact de importvelden:
  - Type applicatie
  - Applicatienaam
  - Omschrijving
  - Handleiding website
  - Didactische component
  - Belangrijkste functies
  - Licenties
  - Key user
- Tab **Verrijking** blijft beschikbaar voor:
  - leverancier koppelen
  - Gilde landschapsdomein
  - MORA / Frank v.G.
  - kroonjuweel
  - overheadfiltering
- Teksten aangescherpt zodat originele import en verrijking gescheiden zijn.

## SQL
- Nieuwe niet-destructieve migratie: `supabase/v0.9.44_software_landscape_original_import.sql`.
- Maakt/controleert benodigde kolommen.
- Voegt view toe: `software_landscape_import_original_view`.
