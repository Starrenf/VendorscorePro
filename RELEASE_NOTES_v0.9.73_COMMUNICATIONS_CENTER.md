# VendorScorePro v0.9.73 - Portal & Communications Center

## Toegevoegd
- Homepagina toont actieve mededelingen als banner.
- Ondersteuning voor type melding: storing, onderhoud, informatie en opgelost.
- Nieuwe adminpagina: Instellingen -> Communicatiecentrum.
- Mededelingen toevoegen, bewerken, pauzeren/activeren en verwijderen.
- Rolgerichte zichtbaarheid via `visible_for_role`.
- Periodevelden: start- en einddatum.
- Prioriteit en doelmodule.

## Database
Voer uit:
`supabase/v0.9.73_communications_center.sql`

## Security
- `system_announcements` gebruikt RLS.
- Alleen leden van dezelfde organisatie kunnen meldingen lezen.
- Alleen admin/super admin/organisatiebeheerder kan meldingen beheren.
- `anon` toegang wordt ingetrokken.
