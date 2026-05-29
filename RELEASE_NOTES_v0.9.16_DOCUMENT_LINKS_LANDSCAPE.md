# VendorScorePro v0.9.16 — Documentlinks & softwarelandschap

## Belangrijkste wijzigingen

- Documentenmodule is omgezet naar veilige linkregistratie.
- VendorScorePro slaat primair alleen Teams/SharePoint-links en metadata op.
- Geen Gilde-documenten hoeven naar Supabase Storage of externe opslag te worden geüpload.
- Nieuwe pagina **Softwarelandschap** onder menu **Meer**.
- CSV-import/paste-import voor applicatielandschap.
- Softwarelandschap kan worden gebruikt om externe uploads, zoals overzichten van Frank van Grinsven, te verrijken en overhead/ruis te filteren.

## Supabase

Voer uit:

```sql
supabase/v0.9.16_document_links_landscape.sql
```

## CSV-kolommen softwarelandschap

Aanbevolen kolommen:

```text
applicatie;leverancier;domein;eigenaar;functioneel_beheer;kritisch;status;bron
```
