# VendorScorePro v0.9.66 - AI Register Stabilisatie & Rich Editing

## Fullstack analyse

### AI-register
- Bestaande records konden leeg openen of opnieuw als insert worden opgeslagen.
- Duplicaten op dezelfde leverancier/applicatie/naam waren mogelijk.
- RLS kan inserts blokkeren wanneer policies ontbreken.
- UUID's waren zichtbaar voor gebruikers.

### Contractsamenvatting
- De TipTap-opmaakbalk was verdwenen en het veld was teruggevallen naar een textarea.
- `updated_by` werd als UUID getoond wanneer geen naam beschikbaar was.

## Verbeteringen
- AI-register gebruikt update wanneer een bestaand record wordt bewerkt.
- Nieuwe AI-items controleren op duplicaten voor organisatie + leverancier + applicatie + naam.
- AI-overzicht toont aangemaakt-door als naam/fallback en geen ruwe UUID.
- TipTap-rich editor teruggebracht bij contractsamenvatting.
- TipTap toegepast op AI-transparantiemaatregelen/notities.
- Contractsamenvatting toont gebruiker/fallback in plaats van UUID.

## SQL
Voer uit:
`supabase/v0.9.66_ai_register_stabilization_rich_editor.sql`

## Backend-impact
Beperkt. Geen bestaande kolommen verwijderd of hernoemd. Alleen RLS/policies en optionele unieke index voor duplicaatpreventie.
