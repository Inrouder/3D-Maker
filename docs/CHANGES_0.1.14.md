# 0.1.14 – Gesperrte Durchgangsvorschau nachvollziehbar beheben

## Fehler und Ursache

Nach einem Fehler bei der Volumenvorbereitung blieb die interne Freigabe `ready` auf `false`. Die Zeichenfunktion prüfte jedoch nur, ob gerade gerechnet wird. Dadurch konnte anschließend eine Kontur markiert werden. Die Meldung „Markierung übernommen“ verdeckte den ursprünglichen Fehler, während „Vorschau berechnen“ weiterhin deaktiviert blieb.

Das Verhalten wurde im Oberflächentest durch einen gezielt ausgelösten Vorbereitungsfehler reproduziert. Der konkrete Auslöser im zuletzt gezeigten Modell lässt sich aus einem Screenshot allein nicht bestimmen.

## Änderungen

- Markieren ist erst nach erfolgreicher Volumenvorbereitung möglich.
- Der Worker meldet die fehlgeschlagene Aktion. Vorbereitungsfehler bleiben als eigener Fehlerhinweis sichtbar und können mit „Modell erneut vorbereiten“ wiederholt werden.
- Unter der Markierung steht, warum die Vorschau gesperrt ist: Vorbereitung, laufende Rechnung, ungültige Eingabe oder fehlende Kontur.
- Beim Wiederholen und beim Wechsel der Bereinigungsoption werden laufende Zeichenaktionen abgebrochen.
- CSG-Ausschnitte können T-Verbindungen hinterlassen: Eine Seite enthält eine lange Kante, die andere mehrere Teilkanten. Die Vorbereitung verbindet solche Kanten an vorhandenen Randpunkten. Nahe Randpunkte werden innerhalb von maximal einem Millionstel der Rand-Boundingbox-Diagonale (mindestens 0,000001 mm) zusammengeführt; numerisch kollabierte Randdreiecke werden entfernt. Räumlich getrennte Flächen werden nicht überbrückt. Die Reparatur bleibt eine lokale Näherung; nicht eindeutig reparierbare Ausschnitte werden weiterhin mit sichtbarer Fehlermeldung abgelehnt.
- Mit eingeschalteter lokaler Bereinigung werden Dreiecke entfernt, deren Eckpunkte beim bestehenden Schweißen auf 0,000001 mm zusammenfallen. Solche Dreiecke konnten die Vorbereitung bislang schon vor der lokalen Reparatur abbrechen lassen. Ohne Bereinigung bleibt die Prüfung streng. Die bestehenden Grenzen für das Entfernen topologisch fehlerhafter Flächen und das Füllen offener Konturen bleiben erhalten; umfangreiche Schäden werden abgelehnt.
- Änderungen werden weiterhin erst mit „Verschluss übernehmen“ am Modell gespeichert.

## Prüfung

- 37 automatisierte Geometrie- und Desktop-Integrationstests: einschließlich kollabiertem Dreieck an einem geschlossenen Würfel, unverändertem Volumen und unveränderter Eingabedatei.
- Zusätzliche Geometrieregression: Quader 30 × 12 × 30 mm mit kegelförmigem CSG-Durchgang, ausgerichtet und um 0,001° geneigt. Vorbereitung ergibt ein gültiges Volumen mit einem Durchgang; die anschließende Vereinigung schließt ihn. Das Ausgangsvolumen wird gegen die analytische Kegelstumpf-Näherung geprüft.
- Oberflächenregression: Vorbereitungsfehler bleibt nach einem Zeichenversuch sichtbar; Vorschau bleibt korrekt gesperrt; Wiederholen mit echtem Worker gelingt; anschließende Markierung gibt die Vorschau frei.
- Der bestehende vollständige Durchgangstest verwendet jetzt zusätzlich ein kollabiertes Dreieck: lokale Bereinigung, Markieren, Vereinigung, Speichern sowie Rückgängig/Wiederholen.
- Produktionsbuild und gesamte Browsersuite werden vor Veröffentlichung geprüft. Der Windows-Build durchläuft außerdem den vorhandenen nativen Offline-Worker-Smoke-Test vor Freigabe des Releases.

## Bedienung

Werkzeug öffnen und auf „Bereit“ warten. Bei einer Fehlermeldung deren Ursache prüfen, gegebenenfalls lokale Bereinigung einschalten und erneut vorbereiten. Danach vollständig auf dem Material um die Öffnung zeichnen und die Vorschau berechnen. Größere offene Meshränder benötigen weiterhin den Rand-Modus.
