# 3D-Maker

**Ein lokaler 3D-Modellierer für Windows und den Browser.** Entwerfe und bearbeite 3D-Objekte in einer übersichtlichen Arbeitsfläche – ohne Benutzerkonto, Cloudzwang, Werbung oder Slicer.

[![Build](https://github.com/Inrouder/3D-Maker/actions/workflows/build.yml/badge.svg)](https://github.com/Inrouder/3D-Maker/actions/workflows/build.yml)
![Version](https://img.shields.io/badge/Version-0.1.11-19b5a5)
![Windows](https://img.shields.io/badge/Windows-Portable-2767bb)
![Status](https://img.shields.io/badge/Status-Experimentell-ef9d38)

> **Entwicklungsstatus:** 3D-Maker befindet sich in aktiver Entwicklung. Vor produktivem Einsatz, besonders bei Passungen, Gewinden oder sicherheitsrelevanten Teilen, Geometrien und exportierte STLs überprüfen.

## Aktuelle Windows-Version herunterladen

**[⬇ Portable EXE direkt herunterladen](https://github.com/Inrouder/3D-Maker/releases/latest/download/3D-Maker-Portable.exe)** · [Versionshinweise und SHA-256-Prüfsummen](https://github.com/Inrouder/3D-Maker/releases/latest)

Der Link zeigt immer auf das neueste vollständig gebaute stabile Release, ohne GitHub-Anmeldung. EXE in einem dauerhaften Ordner ablegen und starten; keine Installation und kein separates Node.js nötig. Actions-Artefakte sind nur temporäre Testbuilds.

**Updates:** Einstellungen → Programm-Updates → Jetzt nach Updates suchen. Eine neue Version wird direkt im Browser heruntergeladen. Arbeit speichern, App schließen und EXE manuell ersetzen; keine heimliche Installation.

**Als Standardprogramm:** Einstellungen → Dateien & Standardprogramm → Dateitypen registrieren → Windows-Standardprogramme öffnen. Dort 3D-Maker für `.3dmaker`, `.stl` und/oder `.obj` auswählen. Nach Verschieben oder Umbenennen der EXE erneut registrieren. Ältere `.3dmaker.json`-Projekte lassen sich weiterhin in der App öffnen; neue Projekte verwenden `.3dmaker`.

## Auf einen Blick

| Modellierung | Projekte & Dateien | Oberfläche |
| --- | --- | --- |
| Quader, Kugeln, Zylinder, Kegel | STL-/OBJ-Import | Interaktive 3D-Arbeitsfläche |
| 3D-Text, Zahnräder, Gewinde | STL-Export | Objekt-Explorer |
| Boolescher Ausschnitt (H) | Projektdateien als JSON | Hell-/Dunkelmodus |
| Ebenenschnitt und Teilen | Lokale Speicherung | Deutsch / Englisch |
| Gruppieren, Duplizieren | Rückgängig / Wiederholen | Präzise mm-Eingaben |

### Typischer Ablauf

1. **Körper erstellen:** Quader, Zylinder oder eine parametrisierte Form einfügen.
2. **Bearbeiten:** Mit den Griffen verschieben, drehen oder skalieren; numerische Maße in Millimetern festlegen.
3. **Kombinieren:** Ein Werkstück und einen Schneidkörper auswählen, dann mit **H** den Ausschnitt durchführen.
4. **Speichern:** Projekt lokal sichern oder Modelle als STL exportieren.

## Design und Programm-Icon

![3D-Maker Icon](public/icon.svg)

Das neue 3D-Würfel-Icon wird als SVG im Browser und als mehrstufiges Windows-ICO in der portablen EXE verwendet. Die Icon-Dateien werden beim Windows-Build automatisch erzeugt (`npm run icon:generate`).

## Windows: portable EXE herunterladen

**Empfohlener Einstieg:** [GitHub Releases](https://github.com/Inrouder/3D-Maker/releases/latest)

1. Die neueste veröffentlichte Version öffnen.
2. `3D-Maker-Portable-<version>.exe` herunterladen.
3. Die EXE starten. Es ist keine klassische Installation und kein separates Node.js erforderlich.

Entwicklungs-/Testbuilds finden sich weiterhin unter [Actions / Build 3DMaker](https://github.com/Inrouder/3D-Maker/actions/workflows/build.yml). Die reguläre Downloadquelle ist der feste Release-Link oben; Actions-Artefakte laufen ab und benötigen häufig eine GitHub-Anmeldung.

### Integrierte Updateprüfung

Die Windows-Version prüft beim Start sowie alle sechs Stunden auf neue **GitHub Releases**. Eine neue Version wird in den Einstellungen angezeigt, inklusive Versionsnummer und Versionshinweisen. Unter **Einstellungen → Programm-Updates** lässt sich die Prüfung auch manuell starten.

- Updates werden **nicht** heimlich installiert: `Update herunterladen` öffnet den direkten EXE-Download des geprüften Releases im Standardbrowser. Vor dem Wechsel die Arbeit speichern, alte EXE schließen und neue EXE starten.
- **Öffentliches Repository:** Die Updateprüfung verwendet die öffentliche GitHub-Releases-API. Es ist **kein Login und kein Token** erforderlich. GitHub kann bei sehr häufigen Abfragen API-Limits anwenden.
- Ohne erreichbaren Release oder GitHub-Zugriff erscheint eine klare Statusmeldung. Für die Browser-Version steht die Electron-Updatefunktion nicht zur Verfügung.
- Die Versionsnummer eines Release-Tags (`v0.1.8` usw.) muss zur App-Version in `package.json` passen.

## Tastenkürzel

| Kürzel | Aktion |
| --- | --- |
| `Strg+C` / `Strg+X` / `Strg+V` | Auswahl kopieren / ausschneiden / einfügen |
| `H` | Ausschnitt: zuerst Zielobjekt, dann Schneidkörper auswählen |
| `C` | Schnittebene aktivieren/deaktivieren |
| `Strg+S` | Projekt speichern |
| `Entf` | Auswahl löschen |
| `Esc` | Auswahl aufheben |
| `Umschalt+Klick` | Mehrere Objekte auswählen |

## Selbst bauen

Node.js 22 und npm werden für die Entwicklung benötigt.

```bash
npm install
npm run dev
```

Web-Produktionsversion:

```bash
npm run build
npm run preview
```

Portable Windows-EXE (unter Windows):

```bash
npm run dist:portable
```

Der GitHub-Actions-Workflow baut Änderungen am Standardbranch und veröffentlicht jede **neue Versionsnummer** nach erfolgreichen Web-/Windows-Tests automatisch als stabiles GitHub Release. Vor einer neuen Programmversion `package.json`, Lockfile und App-Version gemeinsam erhöhen. Vorhandene Versionen werden nicht überschrieben. Ein Tag muss zur Versionsnummer passen.

Jedes Release enthält die versionierte EXE, den festen Namen `3D-Maker-Portable.exe` und `SHA256SUMS.txt`. Dadurch bleiben README-Download und integrierte Updateprüfung dauerhaft auf derselben Quelle. Der Windows-Build prüft außerdem die gepackte App einschließlich Dateiaufruf, Dateizuordnung und Import-/Reparatur-Worker.

## Technologie

React 19 · TypeScript · Three.js · Vite · Electron · electron-builder · GitHub Actions.

3D-Maker speichert Projekte lokal und benötigt für die eigentliche Modellierung keine Netzwerkverbindung. Eine Verbindung zu GitHub wird ausschließlich für optionale Updateprüfungen oder das manuelle Öffnen des Repositorys verwendet.

## Änderungen 0.1.11

[Releases, Updates und Windows-Dateizuordnung](docs/CHANGES_0.1.11.md)

## Änderungen 0.1.10

[Objekt-Zwischenablage: Kopieren, Ausschneiden, Einfügen](docs/CHANGES_0.1.10.md)

## Änderungen 0.1.9

[Reparatur, Einzel-Export, XYZ-Abmessungen und größere Dateien](docs/CHANGES_0.1.9.md)

## Projekt & Mitwirkung

- [Fehlerprüfung, Korrekturen und Testanleitung (10.11.2026)](docs/BUG_AUDIT_2026-11-10.md)
- [Entwicklungsplan](docs/ROADMAP.md)
- [Fehler melden / Vorschlag einreichen](https://github.com/Inrouder/3D-Maker/issues)
- [Quellcode](https://github.com/Inrouder/3D-Maker)

**Projekt:** Shad3pi · 3D-Maker. Eine eigenständige Entwicklung; XYZmaker diente als funktionale Inspiration. Es wird kein proprietärer Code des ursprünglichen Programms verwendet.

**Lizenz:** Eine Projektlizenz ist noch nicht festgelegt. Öffentlich sichtbarer Quellcode ist nicht automatisch Open Source; vor externer Weiterverwendung die Lizenzfrage klären.
