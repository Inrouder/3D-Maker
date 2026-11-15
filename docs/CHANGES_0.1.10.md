# 0.1.10 – Objekt-Zwischenablage

- Strg+C: ausgewählte Objekte kopieren.
- Strg+X: ausgewählte Objekte ausschneiden; Entfernen ist rückgängig machbar.
- Strg+V: Objekt-Zwischenablage einfügen; Einfügen ist rückgängig machbar.
- Entsprechende Buttons links im Abschnitt „Zwischenablage“. Unter macOS funktionieren auch Cmd+C/X/V.
- Kopien erhalten neue Objekt- und Gruppen-IDs und werden sofort ausgewählt. Gruppen bleiben untereinander verbunden, aber unabhängig von der Originalgruppe.
- Kopierte Objekte werden je Einfügen um weitere 10 mm in X und Z versetzt. Ausgeschnittene Objekte werden beim ersten Einfügen an ihrer ursprünglichen Position eingefügt; weiteres Einfügen erzeugt versetzte Kopien.
- Kopierte Geometriedaten werden als unveränderlicher Snapshot referenziert, damit große Meshes nicht unnötig dupliziert werden.
- In Text-/Zahlenfeldern bleiben die üblichen nativen Tastenkürzel erhalten. Offene Dialoge und laufende Import-/Reparaturaktionen sperren Objekt-Zwischenablageaktionen.
- Die Objekt-Zwischenablage gilt innerhalb der laufenden App-Sitzung. Keine systemweite Übertragung von 3D-Objekten an andere Programme; für dauerhaften Austausch Auswahl als Projekt oder STL speichern.

## Prüfungen

Neue Browsertests prüfen wiederholtes Einfügen mit Versatz, Ausschneiden und Wiedereinfügen an ursprünglicher Position, Undo/Redo, unabhängige Gruppenkopien sowie Schutz von Eingabefeldern und Dialogen. Bestehende Tests werden ebenfalls ausgeführt.

Ergebnis: Produktionsbuild und Whitespace-Prüfung erfolgreich. 17 Unit-Tests und 12 Browsertests bestanden (Gesamtlauf mit 11 Tests sowie zusätzlicher Einzeltest für native Clipboard-Ereignisse). Native Copy/Cut/Paste-Ereignisse werden zusätzlich zum Keydown behandelt, damit auch Electron-Menüaktionen funktionieren. Ein interaktiver Windows-Starttest wurde nicht durchgeführt.
