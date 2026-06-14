# VendorScorePro v0.9.13

Gebouwd op basis van `VendorScorePro_v0.9.12_MeetingsRLS_Stable`.

## Gewijzigd

### Governance single source
- Leveranciersoverzicht gebruikt `supplier_overview_view`.
- Dashboard gebruikt `supplier_overview_view` voor governancepercentages, checked-items, total-items en notities.
- Home/statusoverzicht gebruikt `supplier_overview_view` in plaats van losse checklistberekeningen.
- Kroonjuwelenpagina gebruikt `supplier_overview_view` voor leveranciers- en governancegegevens.

### Governance UX
- Governance-checklist werkt nu met expliciete save-flow.
- Extra save button bovenaan en onderaan de checklist.
- Statussen toegevoegd:
  - Opgeslagen
  - Niet-opgeslagen wijzigingen
  - Opslaan…
  - Opslaan mislukt
- Toastmelding bij succesvol of mislukt opslaan.
- Laatst opgeslagen tijdstip zichtbaar.
- Browserwaarschuwing bij verlaten met niet-opgeslagen governancewijzigingen.

### Contractsamenvattingen
- Nieuwe frontendcomponent `ApplicationContractSummary` toegevoegd.
- Locatie: Leverancier → Applicaties & functioneel beheer → Applicatiekaart → Details / contractsamenvatting.
- Functionaliteiten:
  - groot tekstveld
  - versie
  - bronbestand
  - laatst bijgewerkt
  - bijgewerkt door
  - zoeken in tekst
  - save button met toastmelding
  - export naar Word-compatible `.doc`
  - browserwaarschuwing bij niet-opgeslagen wijzigingen

## Buildtest
- `npm install` uitgevoerd.
- `npm run build` succesvol.
- Vite geeft alleen bekende chunk-size waarschuwing; geen buildfout.
