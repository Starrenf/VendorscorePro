# VendorScorePro v0.9.55 - Register-first UX

## Doel
Deze build maakt het applicatieregister rustiger, duidelijker en beter passend bij digitalisering in het MBO.

## Belangrijkste wijzigingen
- Softwarelandschap ingericht als zelfstandig applicatieregister.
- Brondata blijft leidend en wordt niet automatisch vermengd met leveranciers, contracten of governance.
- Nieuwe master-detail weergave: links zoeken/filteren, rechts detailinformatie.
- Tabs per applicatie: Overzicht, Brongegevens, Licenties, Notities, Bewerken.
- Licentiegegevens blijven per applicatie editbaar.
- Records kunnen worden toegevoegd, gewijzigd en verwijderd.
- Duidelijke scheiding tussen Registerlaag en Verrijkingslaag.
- Geen databasewijzigingen verplicht.

## Architectuurprincipe
Registreren → Valideren → Verrijken → Analyseren.
