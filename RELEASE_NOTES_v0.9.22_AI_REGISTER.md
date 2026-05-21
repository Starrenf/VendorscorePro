# VendorScorePro v0.9.22 - AI Register & documentupload voorbereiding

## Nieuw
- Centrale AI-register pagina `/ai-register`.
- AI-register tab op leverancierdetail.
- EU AI Act risicoklassen: onaanvaardbaar, hoog, beperkt, minimaal, onbekend.
- Governance alerts op basis van DPIA, DPA, datalocatie, human oversight, training op klantdata en subverwerkers.
- Mitigerende maatregelen per AI-registeritem.
- Aanbevelingen voor AI-registratie en beoordeling zichtbaar in de frontend.
- Eerste documentupload via lokale bestandsverkenner in het tabblad Documenten.

## Let op
Voor documentupload moet de Supabase Storage bucket `supplier-documents` bestaan. Gebruik het SQL-bestand `supabase/v0.9.22_ai_register_and_document_storage.sql`.

## Volgende stap
- Private bucket + signed URLs.
- Documentmetadata uitbreiden met storage_path, file_name, mime_type, version en uploaded_by.
- AI-register dashboardtegels opnemen in het hoofd-dashboard.
