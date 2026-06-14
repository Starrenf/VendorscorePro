# v0.9.49 Dashboard kroonjuwelen fix

## Aangepast

- Dashboard KPI **Kroonjuwelen** telt niet langer records uit `software_landscape_import`.
- Kroonjuwelen worden alleen geteld op basis van bestaande VendorScorePro-applicaties.
- Definitie dashboard: applicatie is kritisch gemarkeerd én heeft een functioneel-beheerregistratie.
- Kroonjuwelenpagina gebruikt dezelfde afbakening.

## Geen verplichte SQL

Er is geen databasewijziging nodig. Het SQL-bestand bevat alleen een optionele controlequery.
