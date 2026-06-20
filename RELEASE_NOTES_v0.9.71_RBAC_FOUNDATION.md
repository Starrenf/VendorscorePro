# VendorScorePro v0.9.71 - RBAC Foundation Edition

## Toegevoegd
- Nieuwe pagina: Instellingen > Rollenbeheer
- Rollenbibliotheek met standaardrollen:
  - Super Admin
  - Organisatiebeheerder
  - Contractmanager
  - Functioneel Beheerder
  - AI Manager
  - Security Officer
  - Inkoper
  - Viewer
- Gebruikersoverzicht met toegekende rollen
- Rollen toevoegen/verwijderen vanuit de frontend
- Roltemplates voor snelle toewijzing
- Waarschuwing bij risicovolle rollen zoals Super Admin
- Dashboardstatistieken: gebruikers, met rol, zonder rol, Super Admins
- Voorbereiding op menu-filtering en RLS-hardening

## Technisch
- Route toegevoegd: `/settings/roles`
- Admin-menu uitgebreid met Rollenbeheer
- SQL-notitie toegevoegd: `supabase/v0.9.71_rbac_frontend_notes.sql`

## Nog bewust niet gedaan
- Menu's worden nog niet volledig verborgen op basis van rollen
- RLS wordt nog niet per module afgedwongen
- E-mailadressen worden nog niet getoond omdat `profiles` geen `email`-kolom bevat en `auth.users` niet direct vanuit de frontend benaderbaar is

## Volgende stap
- v0.9.72: frontend menu-filtering en moduletoegang op basis van rollen
- v0.9.73: actierechten per module
- v0.9.74: RLS-hardening per tabel/module
