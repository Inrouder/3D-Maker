# 0.1.12 – Gezielt Löcher markieren und schließen

## Bedienung

1. Genau ein Mesh im Explorer auswählen, bei Gruppen ein Mitglied mit Alt-Klick.
2. Rechts unter den Eigenschaften **Löcher markieren & schließen** öffnen.
3. Offene, eindeutige Randkonturen werden orange angezeigt. Eine Öffnung entweder am Rand anklicken, in der Liste auswählen oder mit **Umkreisen** vollständig einschließen.
4. Die neue Verschlussfläche erscheint als grüne Vorschau. Über **Wölbung (mm)** lässt sie sich nach außen oder innen anpassen. Rechts ziehen dreht die Ansicht, das Mausrad zoomt.
5. **Verschluss übernehmen** schließt ausschließlich die gewählte Öffnung. Andere Öffnungen – etwa Hals oder Saum einer Weste – bleiben offen. **Abbrechen/Esc** verwirft die Vorschau. Strg+Z macht eine übernommene Änderung rückgängig.
6. Anschließend wie bisher als Projekt oder über **Auswahl als STL** speichern.

Der Marker wählt eine bereits erkannte Randkontur aus. Er schneidet keine neue Fläche aus dem Modell. Umfasst die Markierung mehrere vollständige Öffnungen, fordert die App eine engere Auswahl oder die Auswahl über die Liste an. Die Randlinien sind zur Orientierung auch durch die Oberfläche sichtbar; die Vorschau muss deshalb auf die richtige Modellseite geprüft werden.

## Geometrie und Anpassung

Das Werkzeug verbindet deckungsgleiche Positionen mit 0,000001 mm Toleranz und sucht geschlossene, unverzweigte Randzyklen. Mehrdeutige/verzweigte oder inkonsistent orientierte Ränder werden ausgelassen; ggf. vorher **Mesh reparieren** verwenden.

Die gewählte Kontur wird auf ihre Flächenebene projiziert, auf Überschneidungen geprüft und trianguliert. Neue Innenkanten werden unterteilt, die Innenpunkte geglättet und optional gewölbt. Die ursprünglichen Randpunkte und ihre 3D-Lage bleiben fest, auch bei nicht ebenen Konturen. Glättungsschritte, die die Dreiecksorientierung in der Projektion umklappen würden, werden reduziert oder verworfen. Die Kanten der Verschlussfläche schließen mit entgegengesetzter Laufrichtung an die vorhandenen Randkanten an. Normalen werden neu berechnet; vorhandene harte Schattierungskanten können dadurch weicher erscheinen.

Analyse und Vorschau laufen in einem Web Worker. Geometrieänderungen oder eine neue Auswahl verwerfen alte Berechnungsergebnisse. Nur beim Übernehmen wird ein neuer Objektstand für Undo gespeichert. Analyse und Vorschau verändern das Original nicht.

## Wichtige Grenze am Westen-Beispiel

Die Funktion ist für **echte offene Mesh-Ränder** gedacht. Viele Kleidungsmodelle sind dünne, offene Oberflächen; deren Armausschnitte lassen sich damit gezielt schließen. Ein vollständig wasserdichtes, dickwandiges Modell kann dagegen ein Armloch als geschlossenen Durchgang mit Innen-/Außenwand besitzen. Dort gibt es keinen offenen Mesh-Rand, den dieses Verfahren füllen könnte. Die App meldet diesen Fall, statt ungeprüfte zusätzliche Innenflächen einzubauen. Auch Selbstüberschneidungen der neuen Fläche mit entfernten Teilen des bestehenden Modells werden nicht allgemein gelöst. Die Vorschau rekonstruiert keine unbekannte ursprüngliche Kleidungsform.

Stark gefaltete, in der Projektion überlappende Konturen werden abgewiesen. Für Füllungen ist die Randkomplexität auf 4096 Punkte begrenzt; das begrenzt die Kosten der Konturprüfung und Unterteilung. Bei großen Modellen hängen Laufzeit und Speicher weiterhin von der gesamten Geometrie ab.

## Prüfung

Unit-Tests prüfen zwei unabhängig verschließbare Öffnungen, STL-Dreieckssuppen, entgegengesetzte Kantenlaufrichtung, konkave/nicht ebene Konturen, Wölbung, feste Randpunkte, kollineare Randpunkte und das Abweisen geschlossener/mehrdeutiger/überschneidender Fälle. Browsertests prüfen Vorschau, Übernehmen, Projektpersistenz, Undo/Redo, Umkreis-Auswahl ohne Objektbewegung und Abbruch.

Der Windows-Smoke-Test wird um den tatsächlichen Aufruf des Löcher-Workers aus der gepackten App ergänzt. Der automatische Release-Workflow veröffentlicht Version 0.1.12 erst nach erfolgreichem Build und Windows-Test.

### Lokale Ergebnisse

Produktionsbuild und Whitespace-Prüfung erfolgreich. 28 Unit-/Desktoptests und 18 unterschiedliche Browsertests bestanden (Gesamtlauf mit 17 Tests, danach die vier Löcher-Tests einschließlich ergänzter Kleinfenster-/Neuberechnungsprüfung). Vorschau bei 1440 × 900 visuell geprüft. Bei 960 × 640 kann das Werkzeugpanel eingeklappt werden, um die Markierung freizulegen. Ungültige/noch unvollständige Wölbungseingaben können nicht übernommen werden.
