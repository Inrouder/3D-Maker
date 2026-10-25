# 3DMaker

**Ein kostenloser, lokaler 3D-Modellierer – ohne Werbung, Login, Cloud oder Druckerfunktionen.**

3DMaker ist eine unabhängige Neuentwicklung mit XYZmaker 1.2 als funktionaler Inspiration. Es wird kein proprietärer Code des ursprünglichen Programms verwendet.

## Aktueller Stand

Der erste Entwicklungsstand enthält:

- Interaktive 3D-Ansicht mit Orbit, Zoom und Raster
- Grundkörper: Quader, Zylinder, Kugel und Kegel
- Objekt-Explorer und numerische Position, Drehung und Abmessungen in mm
- Boolean-Operation **Ausschnitt / Cut**: Zielobjekt minus Schneidkörper
- Tastenkürzel **H**
- Lokales Projektformat `.3dmaker.json`
- STL importieren und exportieren
- Kein Login, keine Werbung, keine Telemetrie und keine externen Schrift- oder Cloud-Abhängigkeiten

> **Wichtig:** Dieses Projekt ist derzeit ein früher Prototyp. Vor der Verwendung für präzise oder sicherheitskritische Teile müssen Boolean-Ergebnisse, Einheiten, Mesh-Validierung und Export anhand von Testmodellen überprüft werden. Noch nicht implementierte Funktionen werden nicht als fertig dargestellt.

## Ausschnitt / Cut (H)

1. Erstelle oder importiere das **Zielobjekt** (zum Beispiel einen Quader).
2. Erstelle den **Schneidkörper** (zum Beispiel einen Zylinder mit 6 mm Durchmesser und 100 mm Länge).
3. Positioniere den Schneidkörper so, dass er vollständig durch das Zielobjekt reicht.
4. Wähle zuerst das Zielobjekt und danach mit **Umschalt-Klick** den Schneidkörper aus. Die Reihenfolge ist wichtig.
5. Drücke **H** oder betätige „Ausschnitt / Cut“.
6. Der Schneidkörper wird vom Zielobjekt abgezogen und anschließend aus der Szene entfernt.

Der Standard-Quader ist 40 × 12 × 40 mm groß. Ein neuer Zylinder ist 6 mm im Durchmesser und 100 mm lang und liegt zunächst zentriert, sodass er die 12 mm dicke Platte vollständig durchquert.

## Starten (Entwicklung)

Voraussetzung: eine aktuelle Node.js-LTS-Version und npm.

```bash
npm install
npm run dev
```

Für den Produktions-Build:

```bash
npm run build
npm run preview
```

## Tastenkürzel

| Taste | Funktion |
| --- | --- |
| `H` | Boolean-Ausschnitt (erstes ausgewähltes Objekt minus zweites) |
| `Strg+S` | Projekt lokal als Datei speichern |
| `Entf` | Ausgewählte Objekte löschen |
| `Esc` | Auswahl aufheben |
| `Umschalt+Klick` | Objekt zur Auswahl hinzufügen/entfernen |

## Geplante Entwicklung

Siehe [docs/ROADMAP.md](docs/ROADMAP.md). Es gibt absichtlich **keine** Druckerprofile, keinen Slicer und keinen G-Code-Export. STL ist ausschließlich ein neutrales 3D-Austauschformat.

## Lizenz

Lizenzentscheidung noch offen. Vor einer Veröffentlichung bitte Lizenz und Notices aller Abhängigkeiten prüfen und eine Projektlizenz ergänzen.
