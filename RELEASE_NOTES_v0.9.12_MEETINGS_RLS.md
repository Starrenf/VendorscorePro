# VendorScorePro v0.9.12 – Meetings/RLS fix

Deze release bouwt verder op de laatste stable met dashboard drilldown, risk RLS en logo's.

## Aangepast
- `SupplierMeetingsTab.jsx`
  - gebruikt nu `organization?.id || supplier?.organization_id` als fallback.
  - blokkeert toevoegen/opslaan netjes als leverancier of organisatie ontbreekt.
  - behoudt toast/save-flow.
- `SupplierActionsTab.jsx`
  - gebruikt dezelfde organization fallback.
  - acties kunnen overleggen blijven ophalen/koppelen.

## Toegevoegd
- `supabase/migrations/20260507_supplier_meetings_rls.sql`
  - maakt/controleert `supplier_meetings`.
  - zet indexes.
  - zet RLS policies voor select/insert/update/delete via `profiles.organization_id`.

## Testadvies
1. Voer SQL uit in Supabase.
2. Start app opnieuw.
3. Open leverancier > Overleggen.
4. Voeg overleg toe en sla op.
5. Refresh pagina en controleer of overleg blijft staan.
