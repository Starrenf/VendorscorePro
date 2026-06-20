# VendorScorePro v0.9.72 - RBAC org_memberships fix

## Aanpassing
- Rollenbeheer haalt gebruikers nu op via `org_memberships` in plaats van `profiles.organization_id`.
- Dit sluit aan op het actuele datamodel waarin organisatiekoppeling via `org_memberships.user_id` loopt.
- Gebruikers die wel in de organisatie zitten maar geen `profiles.organization_id` hebben, worden nu zichtbaar.
- Organisatierol en legacy profile role worden apart getoond.

## Database
- Geen verplichte schemawijziging.
- SQL-notities toegevoegd voor orphan-profile controle en optionele opschoning.
