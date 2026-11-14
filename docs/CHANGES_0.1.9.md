# 0.1.9 – Mesh-Bearbeitung, Reparatur und Einzel-Export

Basis: vorheriger Korrekturstand `c82ebf9` aus PR #1.

## Änderungen und Bedienung

- **Abmessungen X/Y/Z:** Die Beschriftungen B/H/T wurden ersetzt. Die Werte beziehen sich auf lokale Objektachsen, unabhängig von der Drehung. Feld mit Enter oder durch Verlassen übernehmen. Numerische Änderungen verwenden den aktuellen Objektzustand; beim Objektwechsel werden Eingabeentwürfe zurückgesetzt.
- **Z nach Drehung:** Importierte und primitive Körper werden bei Transformationsänderungen nicht mehr unnötig ersetzt. Abmessungen bauen ausschließlich die Geometrie des geänderten Körpers neu auf. Der Regressionstest rotiert ein importiertes Mesh um X=90°, setzt Z=27 mm und liest die exportierte STL wieder ein: Welt-Y muss danach 27 mm sein. Der Test prüft damit die tatsächliche Oberfläche statt nur den angezeigten Wert.
- **Mesh reparieren:** Genau einen Körper auswählen, rechts „Mesh reparieren“. Die Operation läuft in einem Worker und ist rückgängig machbar. Ungültige, degenerierte und doppelte Dreiecke werden entfernt, deckungsgleiche Punkte mit 0,000001 mm Toleranz verbunden, benachbarte Dreiecke konsistent ausgerichtet und geschlossene Komponenten anhand ihres vorzeichenbehafteten Volumens nach außen orientiert. Normalen werden beim Szenenaufbau neu berechnet. Status meldet entfernte Dreiecke, offene und nicht-manifolde Kanten. **Keine automatische Lochfüllung oder garantierte Reparatur von Selbstüberschneidungen.**
- **Auswahl als STL:** Rechts exportieren. Ein ausgewählter Körper ergibt eine Datei mit seinem Namen; mehrere ausgewählte Körper ergeben eine gemeinsame Auswahl-STL. Position, Rotation und Skalierung werden berücksichtigt. „STL exportieren“ oben exportiert weiterhin das gesamte Projekt. STL ist jetzt binär, was Dateigröße und Serialisierungsaufwand reduziert.
- **Auswahl als Projekt:** Speichert ausschließlich ausgewählte Objekte in einer separat wieder bearbeitbaren `.3dmaker.json`-Datei, ohne Bindung an nicht exportierte Gruppenmitglieder.
- **Mittelschnitt:** Beide Hälften werden zu unabhängig auswählbaren Objekten. Erste Hälfte im Explorer anklicken und exportieren, dann zweite Hälfte anklicken und exportieren. Alt-Klick im Explorer wählt auch sonst ein einzelnes Gruppenmitglied aus.

## Größere Dateien

- STL/OBJ werden im Hintergrund geparst. Eingangs-ArrayBuffer wird ohne zusätzliche Kopie an den Worker übertragen.
- Gemischte OBJ-Attribute werden auf Positionsdaten normalisiert, sodass Mesh-Teile mit/ohne UV/Normalen gemeinsam importiert werden können.
- Unveränderte Geometrien und Materialien werden wiederverwendet. Auswahl und Werkzeugwechsel bauen keine Objektgeometrien mehr neu auf.
- Undo speichert immutable Objektstände mit gemeinsam genutzten Geometriedaten statt vollständiger JSON-Tiefkopien bei jeder Bewegung.
- Importierte temporäre Geometrien sowie ersetzte/gelöschte Szenenressourcen werden freigegeben.

Grenzen: Projekt-JSON und STL-Export laufen weiterhin auf dem Hauptthread; die endgültige Übergabe der Positionsarrays und der GPU-Upload benötigen weiterhin Zeit und Speicher. CSG ist weiterhin synchron und kann bei sehr großen Modellen blockieren. Die Reparatur benötigt zusätzlichen Speicher für Vertex-/Kanten-Tabellen. Diese Version macht keine unbegrenzten Dateigrößen oder allgemeine CSG-Beschleunigung geltend.

## Prüfung

- `npm run build`: TypeScript und Produktionsbundle inklusive Worker.
- `npm test`: 17 Tests einschließlich Reparatur von doppelten/degenerierten Flächen und geschlossenem Würfel.
- `npm run test:browser`: bisherige Regressionen plus importiertes gedrehtes Mesh, echter Einzel-STL-Export, Reparatur-Worker, separat exportierte Schnitthälften und großer STL-Import.
- Windows-Portable-Build wird separat mit GitHub Actions erzeugt. Kein interaktiver Windows-Starttest in der Linux-Umgebung.

### Lokales Prüfergebnis

- Produktionsbuild erfolgreich; 17/17 Unit-Tests und 9/9 Chromium-Browsertests bestanden.
- Belastungsprobe: binäre STL mit **261.120 Dreiecken**, **13.056.084 Bytes**; Import und anschließende Z-Änderung im automatisierten Lauf etwa **5,5 Sekunden** (einschließlich Browser-Navigation/Dateiübergabe). Einstellungen konnten währenddessen geöffnet werden. Einzelmessung auf dieser Linux-Testmaschine, kein allgemeines Geschwindigkeitsversprechen.
- Ein früher parallel gestarteter Belastungstest scheiterte beim gemeinsam verwendeten Vite-Testserver. Die komplette Suite wurde anschließend allein und erfolgreich wiederholt.
