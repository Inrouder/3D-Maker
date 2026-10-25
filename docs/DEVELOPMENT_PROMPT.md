# Entwicklungs-Prompt für Coding-Agenten

Du arbeitest am Repository `Inrouder/3D-Maker`. Entwickle einen eigenständigen, kostenlosen lokalen 3D-Modellierer, der sich konzeptionell an XYZmaker 1.2 orientiert, ohne proprietären Quellcode oder geschützte Ressourcen zu übernehmen.

## Nicht verhandelbare Anforderungen

- Keine Werbung, keine Benutzerkonten, kein Login, keine Telemetrie, kein Cloud-Zwang.
- Keine verpflichtende Internetverbindung; keine extern geladenen Fonts, Skripte oder Dienste.
- **Keine 3D-Druckerfunktionen:** kein Slicer, keine Druckerprofile, kein G-Code, keine Druckersteuerung. STL bleibt ein neutrales Modell-Austauschformat.
- Vorrang haben präzise Modellierung und Boolean-Geometrieoperationen.
- Standardoberfläche Deutsch, Maßeinheit Millimeter.
- Arbeite direkt im bestehenden Repository und bewahre funktionierende Funktionen.

## Wichtigste Funktion: Ausschnitt / Boolean Difference

Implementiere eine echte geometrische Differenz mit der Tastenkombination `H`.

Bedienablauf:
1. Nutzer wählt zuerst das Zielobjekt (das Werkstück).
2. Nutzer wählt mit Umschalt-Klick das zweite Objekt als Schneidkörper.
3. `H` führt `Zielobjekt MINUS Schneidkörper` aus.
4. Der Schneidkörper wird anschließend entfernt; das Zielobjekt bleibt mit der tatsächlich ausgeschnittenen Geometrie bestehen.

Beispieltest: Quader 40 × 12 × 40 mm; Zylinder mit 6 mm Durchmesser und 100 mm Länge. Der Zylinder muss mittig durch die 12-mm-Dicke des Quaders reichen und nach der Differenz ein echtes durchgehendes Loch hinterlassen. Der Test muss auch bei verschobenen, gedrehten und skalierten Objekten funktionieren.

Die Boolean-Operation darf nicht nur die Darstellung ändern: Die resultierende Mesh-Geometrie muss tatsächlich verändert und exportierbar sein. Prüfe ungültige, offene oder nicht-manifold Meshes und gib verständliche Fehler aus. Unterstütze die verwendeten Geometrien in automatisierten Tests.

## Weitere Kernfunktionen

- 3D-Viewport mit Orbit, Zoom, Auswahl, Raster und Achsen.
- Grundkörper, darunter Quader, Kugel, Zylinder und Kegel.
- Objekt-Explorer und Eigenschaften mit numerischen Transformationen.
- Rückgängig/Wiederholen, Duplizieren, Ausrichten, Spiegeln und Gruppieren.
- Projektdateien lokal speichern und wieder öffnen.
- STL- und OBJ-Import/Export; Importnetze vor Boolean-Operationen normalisieren.
- Später: Boolean-Vereinigung und Schnitt, Text-Extrusion, parametrischer Geometry Generator, Object Array, Mesh-Vereinfachung, Subdivision und Photo Emboss.
- Alle Bedienelemente müssen echte Funktionen haben; nicht implementierte Features klar kennzeichnen.

## Qualität und Ablauf

1. Repository und vorhandenen Code zuerst prüfen.
2. Architektur und Änderungen klein und nachvollziehbar halten.
3. Automatisierte Tests für Boolean-Differenz, Transformationen, Projektdateien und STL-Import/Export schreiben.
4. Build und Tests nach jeder wesentlichen Änderung ausführen.
5. Fehler beheben, bevor weitere Funktionen begonnen werden.
6. Dokumentation und Roadmap aktuell halten.
7. Keine erfolgreichen Tests oder Releases behaupten, bevor sie tatsächlich gelaufen sind.
8. Vor Paketierung Lizenz und Abhängigkeiten prüfen.

## Abnahmekriterien

Ein Benutzer kann die Anwendung offline starten, Grundkörper erstellen und exakt positionieren, den ersten Körper als Ziel und den zweiten als Schneidkörper wählen, mit `H` ein echtes Loch ausschneiden, das Ergebnis speichern und als STL exportieren. Es gibt keine Anmeldung, Werbung oder Druckeroptionen.
