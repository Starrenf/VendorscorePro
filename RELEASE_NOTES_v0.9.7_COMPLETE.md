# VendorScorePro v0.9.7 COMPLETE

Deze complete projectversie is opgebouwd vanaf de volledige v0.9.4 ProductionProof-basis en bevat opnieuw de fixes uit de latere patch-versies.

## Meegenomen fixes

- Applicaties & functioneel beheer: robuuste organisatiecontext via fallback op `supplier.organization_id`.
- SupplierDetail: tabs krijgen een effectieve organisatiecontext mee, ook als `organization` zelf nog niet geladen is maar `profile.organization_id` wel beschikbaar is.
- Kroonjuwelen/dashboard: kritische applicaties worden gefilterd op actieve applicaties.
- Dashboard: leveranciers worden gefilterd op actieve leveranciers en niet-inactieve status.
- Domeinweergave: domeinwaarden zoals `SIS`, `ITSM`, `roostering`, `toetsing`, `examinering`, `IAM`, `SaaS` en `cloud` worden getoond als ICT in plaats van Generiek.
- CriticalAppsPage: leverancierdomein wordt meegenomen in de kaartweergave.

## Installatie

```bash
npm install
npm run dev
```

Voor build:

```bash
npm run build
```

## Let op

`node_modules` en `dist` zijn bewust niet meegeleverd. Dat is standaard en voorkomt platformafhankelijke fouten.
