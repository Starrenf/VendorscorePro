# VendorScorePro v0.9.59 – Applicatie- & licentieregister veilig

Deze build volgt het uitgangspunt: **niet samenvoegen, maar ordenen**.

## Aangepast
- Softwarelandschap wordt gepresenteerd als **Applicatie- & licentieregister**.
- `application_type` blijft de bronwaarde / domein-type uit de import.
- Nieuwe aparte softwareclassificatie voor Burcht, Stad, Land, Schiereiland.
- Installatiebeheer toegevoegd: aantal installaties, bron telling en laatste controle.
- Archiveren toegevoegd als veilige optie naast verwijderen.
- Licenties, installaties, brongegevens en notities blijven gescheiden.
- Geen koppeling met leveranciers, contracten, governance of kroonjuwelen.

## SQL
Voer uit:

`supabase/v0.9.59_app_license_register_safe.sql`

## Geen impact op
- Leveranciersregister
- Contracten
- Governance
- Kroonjuwelen-dashboard
- Documentregister
