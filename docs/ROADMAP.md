# 3DMaker – technische Roadmap

## Leitplanken

- Keine Werbung, Anmeldung, Telemetrie oder Cloud-Abhängigkeit.
- Keine Druckeroptionen, kein Slicer, keine Druckerprofile, kein G-Code.
- Modellieren und Geometrie bearbeiten haben Vorrang.
- Bedienoberfläche standardmäßig auf Deutsch.
- Eigenständige Implementierung; keine Übernahme proprietärer XYZmaker-Ressourcen.

## Priorität 0 – Geometrie zuverlässig machen

- [ ] Automatisierte Tests für Quader-minus-Zylinder, Zylinder-minus-Quader und nicht überlappende Körper.
- [ ] Boolean-Ergebnisse auf geschlossene, gültige Dreiecksnetze prüfen.
- [ ] STL-Import vor Boolean-Operationen normalisieren/indizieren.
- [ ] Fehlermeldungen bei ungültigen oder nicht unterstützten Meshes verständlich darstellen.
- [ ] Sicherstellen, dass Boolean-Operationen Position, Rotation und Skalierung korrekt berücksichtigen.
- [ ] Undo/Redo für Modelloperationen ergänzen.

## Priorität 1 – Modellierwerkzeuge

- [ ] Verschiebe-/Dreh-/Skalier-Manipulatoren direkt im 3D-Viewport.
- [ ] Ausrichten, zentrieren, spiegeln und Duplizieren.
- [ ] Boolean-Vereinigung und Schnitt zusätzlich zur Differenz.
- [ ] Objektgruppen und Szenenverwaltung.
- [ ] Text als extrudierte 3D-Geometrie.
- [ ] Projektdateien validieren und Versionierung/Migration ergänzen.

## Priorität 2 – Werkzeuge nach XYZmaker 1.2

- [ ] Parametrischer Geometry Generator.
- [ ] Lineares und kreisförmiges Object Array.
- [ ] Mesh-Vereinfachung.
- [ ] Triangular Subdivision.
- [ ] Photo Emboss aus Graustufenbildern.
- [ ] Lokale Vorlagenbibliothek.

## Qualität und Auslieferung

- [ ] Tests für Import/Export und Projektdateien.
- [ ] CI-Build auf jedem Push und Pull Request.
- [ ] Windows-Desktop-Paketierung, sobald die Browser-Version stabil ist.
- [ ] Lizenz- und Abhängigkeitsprüfung.
- [ ] Release-Artefakte und Installationsanleitung.
