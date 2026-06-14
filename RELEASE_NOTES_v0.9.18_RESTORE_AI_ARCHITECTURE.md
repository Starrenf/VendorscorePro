# VendorScorePro v0.9.18 - Restore AI, architectuur en header icons

Hersteld/toegevoegd:
- AI-register hoofdmodule teruggezet.
- AI-tab op leveranciersdetail teruggezet.
- AI-velden bij subverwerkers teruggezet.
- Bewaartermijnen-tab teruggezet.
- Architectuurcockpit en Frank van Grinsven/Architect view teruggezet.
- Architectuurrelaties, domeinen en match review routes teruggezet.
- Header/navigatie met icons teruggezet via lucide-react.
- Logo/assets voor architectuur teruggezet.
- Softwarelandschap-module uit v0.9.17 behouden.
- Teams/SharePoint documentlink-aanpak behouden; geen bestandsupload naar externe opslag.

Belangrijk Supabase:
Voer minimaal uit:
- supabase/v0.9.18_restore_ai_architecture_ui.sql

Voor architectuurdata uit Frank van Grinsven/MORA indien nog niet aanwezig:
- supabase/v0.9.30_mora_deep_import_domains_relations.sql
- supabase/v0.9.33_architect_view_reference.sql
- supabase/v0.9.36_mora_match_review_workflow.sql

Let op: v0.9.22_ai_register_and_document_storage.sql bevat oude storage-bucket voorbereiding; die is bewust niet nodig voor de huidige Teams/SharePoint-linkstrategie.
