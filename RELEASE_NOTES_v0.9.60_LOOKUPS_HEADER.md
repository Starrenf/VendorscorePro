# VendorScorePro v0.9.60 — Waardelijsten & Header UX

## Doel
Veilige doorontwikkeling zonder zware backend-impact.

## Aangepast
- Header compacter gemaakt zodat menu-items niet meer over elkaar schuiven.
- Primaire navigatie beperkt tot Dashboard, Applicaties en Leveranciers.
- Overige modules staan onder Meer.
- Instellingen bevat nu waardelijstbeheer voor admins.
- Applicatie- & Licentieregister gebruikt dropdowns voor:
  - Softwareclassificatie
  - Installatiebron
  - Licentiemodel
  - Bron gebruiksdata
  - Licentie-eenheid
- Waarden gebruiken consistente schrijfwijze met hoofdletters, bijvoorbeeld Burcht, Stad, Intune.

## SQL
Voer uit:
`supabase/v0.9.60_lookup_values_and_header_ux.sql`

## Backend-impact
Minimaal: één generieke tabel `lookup_values`. Bestaande tabellen en routes blijven behouden.
