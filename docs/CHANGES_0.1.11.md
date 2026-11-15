# 0.1.11 – Veröffentlichungen, Updates und Dateizuordnung

## Ursache und Lösung

Bisher lagen aktuelle Builds nur als kurzlebige Actions-Artefakte auf einem Entwicklungsbranch. Die Updatefunktion fragt jedoch `/releases/latest` ab. Ohne veröffentlichtes stabiles Release konnte sie keine neuen Builds finden.

Der Hauptbranch veröffentlicht künftig jede neue Versionsnummer nach erfolgreichen Web- und Windows-Jobs automatisch. Releases enthalten eine versionierte EXE, den festen Alias `3D-Maker-Portable.exe` und SHA-256-Prüfsummen. Der README-Link `/releases/latest/download/3D-Maker-Portable.exe` benötigt keine GitHub-Anmeldung. Bestehende Versionen werden nicht überschrieben; neue Änderungen benötigen eine neue Versionsnummer.

Die Updateprüfung akzeptiert nur stabile Releases mit exakt passender, vorhandener Windows-EXE im Projekt-Repository. Versionsvergleich arbeitet numerisch, auch bei mehrstelligen Patchversionen. „Update herunterladen“ öffnet direkt den passenden EXE-Download (fester EXE-Dateiname innerhalb des geprüften Releases). Der Austausch bleibt manuell: Arbeit speichern, App schließen, EXE ersetzen. Keine automatische Installation oder Neustart mit Verlust ungespeicherter Arbeit.

## Dateien öffnen und als Standard verwenden

1. Portable EXE dauerhaft ablegen, z. B. unter einem eigenen Programme-Ordner.
2. Einstellungen → Dateien & Standardprogramm → Dateitypen registrieren.
3. Windows-Standardprogramme öffnen und 3D-Maker für `.3dmaker`, `.stl` und/oder `.obj` auswählen.

Die Registrierung schreibt nur benutzerbezogene HKCU-Einträge. Windows' geschützte UserChoice-Einstellung wird nicht überschrieben: Die Standardwahl trifft der Nutzer in Windows. Die Registrierung nutzt `PORTABLE_EXECUTABLE_FILE`, also den dauerhaften Launcher, statt des temporär entpackten Electron-Pfads. Nach Umbenennen/Verschieben der EXE erneut registrieren. Keine Administratorrechte erforderlich.

Neue Projekte und Auswahl-Projekte verwenden `.3dmaker`. Alte `.3dmaker.json`/JSON-Projekte bleiben über „Öffnen“, Drag & Drop und den Dateidialog lesbar. **Keine allgemeine Zuordnung für `.json`**, damit andere JSON-Dateien unberührt bleiben.

Die App verarbeitet Dateiaufrufe beim Start und in einer bereits laufenden Instanz. Nur eine App-Instanz läuft; spätere Dateiaufrufe werden an sie weitergereicht. Projekte ersetzen nach Bestätigung vorhandene bearbeitete Arbeitsflächen; STL/OBJ werden importiert. Bei der ersten extern geöffneten Mesh-Datei entfällt der Beispielquader. Lesen von Windows-Dateiaufrufen ist auf unterstützte lokale Dateitypen bis 512 MB begrenzt. Die Bridge akzeptiert keine beliebigen vom Renderer übergebenen Dateipfade.

Unter Einstellungen gibt es auch „Datei öffnen …“. In der Windows-App ist das ein nativer Dialog, im Browser eine Dateiauswahl. Native Fehler und Registrierungs-/Updatefehler sind sichtbar statt unbehandelter Promise-Rejections.

## Prüfung

- TypeScript/Produktionsbuild, Node-/Geometrietests und komplette Chromium-Suite.
- Neue Tests: Versionsvergleich, unvollständige/fremde Release-Downloads, Windows-Registry-Pfadquotierung, keine JSON-/UserChoice-Übernahme, Einstellungen mit Fehleranzeige, Dateieingang beim Start und während laufender App.
- Windows-CI-Smoke-Test startet die gepackte App, prüft Startup-Projekt, echte HKCU-Zuordnung zum dauerhaften Launcher, zweiten Dateiaufruf sowie STL-Import- und Reparatur-Worker aus dem gepackten `file://`-Build.
- Keine Überprüfung der manuellen Standard-App-Auswahl auf dem privaten Windows-PC; diese Einstellung bleibt eine Nutzeraktion.

## Ausgeführte Ergebnisse

Produktionsbuild erfolgreich; 22 Unit-/Desktoptests und 14 Browsertests bestanden. Der Windows-Testlauf [43756551997](https://github.com/Inrouder/3D-Maker/actions/runs/43756551997) hat auch den Smoke-Test der gepackten App erfolgreich ausgeführt (Projektstart, Launcher-Registry, zweite Instanz, STL-/Reparatur-Worker). Die manuelle Standard-App-Auswahl auf dem Nutzer-PC bleibt erforderlich.
