# VendorScorePro v0.9.64 - Beheerbare dropdowns

## Toegevoegd
- Domein / type applicatie is nu een dropdown in het Applicatie- & Licentieregister.
- KeyUser is nu een dropdown in het Applicatie- & Licentieregister.
- Beide dropdowns worden gevuld vanuit `lookup_values`.
- Waarden zijn beheerbaar via **Instellingen → Waardelijsten**.
- Standaardwaarden voor `application_type` en `key_user` toegevoegd.

## Backend
Voer uit:

`supabase/v0.9.64_manageable_dropdowns.sql`

## Geen grote backend-impact
De bestaande kolommen blijven leidend:
- `software_landscape_import.application_type`
- `software_landscape_import.key_user`
