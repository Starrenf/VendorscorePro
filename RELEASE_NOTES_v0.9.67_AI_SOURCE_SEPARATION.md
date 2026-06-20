# VendorScorePro v0.9.67 - AI-bronscheiding & Subverwerker Cleanup

## Doel
Deze build voorkomt dat oude AI-analyses uit `subprocessors.notes` worden getoond alsof ze uit het nieuwe AI-register komen.

## Aangepast
- Subverwerkers tonen alleen nog of een AI-component aanwezig is.
- Inhoudelijke AI-governance wordt uitsluitend via het centrale AI-register vastgelegd.
- Legacy AI-analyseblokken in subverwerker-notities worden in de frontend verborgen met een waarschuwing.
- Tablabel aangepast van “Subverwerkers & AI” naar “Subverwerkers”.
- SQL toegevoegd om oude AI-analyse uit `subprocessors.notes` op te schonen.
- AI-register RLS en duplicaatpreventie opnieuw geborgd.

## Belangrijke ontwerpkeuze
`subprocessors` = subverwerkerinformatie + AI-indicatie.
`ai_register` = inhoudelijke AI-governance, EU AI Act, DPIA, human oversight, datalocatie, modelinformatie en maatregelen.

## SQL
Voer uit:
`supabase/v0.9.67_ai_subprocessor_separation_cleanup.sql`
