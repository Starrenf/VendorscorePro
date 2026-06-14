# VendorScorePro v0.9.62

## Fix
- Leveranciersoverzicht gebruikt nu `supplier.domain` uit `supplier_overview_view`.
- Badge toont niet langer onterecht `Domein Generiek` wanneer detailpagina `ICT` bevat.
- Nieuwe leveranciers krijgen standaard `domain = ICT` naast bestaande category fallback.

## SQL
- `supabase/v0.9.62_supplier_domain_overview_fix.sql`
