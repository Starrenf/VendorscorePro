# VendorScorePro v0.9.23 — Subprocessor AI opslagfix

## Wijzigingen
- AI-data bij subverwerkers wordt nu daadwerkelijk meegestuurd naar Supabase.
- Nieuwe EU AI Act-risicoklasse toegevoegd aan subverwerkers.
- Extra AI-categorieën toegevoegd, waaronder onderwijsbeoordeling, HR/recruitment, biometrie en emotieherkenning.
- Save-flow controleert nu Supabase response en geeft een duidelijke foutmelding als de migratie ontbreekt.
- Overzicht toont AI-risicoklasse, provider, model, use case en governance-notities.

## Vereist SQL-script
Voer vóór testen uit:

```sql
supabase/v0.9.23_subprocessors_ai_register_fields.sql
```
