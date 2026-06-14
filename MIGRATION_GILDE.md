# Gilde migratie naar VendorScore Pro

Dit project bevat een basis migratiescript om alleen Gilde-data uit de bestaande VendorScore omgeving naar VendorScore Pro te kopiëren.

## Scope van deze eerste versie
- suppliers
- supplier_contacts
- supplier_progress

## Benodigde environment variables

```bash
export OLD_SUPABASE_URL="..."
export OLD_SUPABASE_SERVICE_ROLE_KEY="..."
export NEW_SUPABASE_URL="..."
export NEW_SUPABASE_SERVICE_ROLE_KEY="..."
export GILDE_ORG_ID="7ec54263-6b9b-4cb2-9b97-526d8909550d"
```

## Draaien

```bash
node scripts/migrate-gilde-to-pro.mjs
```

## Opmerking
Gebruik dit script eerst in een testomgeving of nadat je een database backup hebt gemaakt.
