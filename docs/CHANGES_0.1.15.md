# 0.1.15 – Z nach oben, Proportionen sperren und Achsen hervorheben

## Orientierung

Die bisherige Arbeitsfläche verwendete Y als Höhe. Das entsprach nicht der gewünschten Achsenzuordnung im Referenzbild. Jetzt gilt ein rechtshändiges Z-up-System:

- X und Y liegen auf dem Boden; Z zeigt nach oben.
- Die Umrechnung lautet `(X neu, Y neu, Z neu) = (Z alt, X alt, Y alt)`.
- In der Standardansicht liegt X links, Y rechts/vorne und Z oben. Die Achsenfarben folgen den Werkzeugen: X rot, Y grün, Z blau.
- Der Achsenkompass zeigt die Weltachsen aus der aktuellen Kameraperspektive und dreht sich bei Orbit-Bewegungen mit.
- Raster, Kamera, Beleuchtung, Grundkörper, Gewinde, Zahnräder, Bodenausrichtung, Verschieben auf dem Boden, Duplizieren/Einfügen und Schnitte verwenden dieselbe Zuordnung. Zylinder-/Kegelhöhen und Gewindelängen verlaufen entlang Z; Zahnräder liegen in XY.
- Positionsfelder und Verschiebegriffe verwenden Weltachsen. Abmessungen und Skalierung verwenden lokale Objektachsen, auch nach Drehungen. Drehungsfelder sind Euler-Winkel mit Reihenfolge XYZ.
- STL und OBJ behalten beim Import ihre Dateikoordinaten. Es findet keine automatische Achsenvertauschung statt. Der STL-Export verwendet dieselben XYZ-Koordinaten wie die Arbeitsfläche. Dateien enthalten keine zuverlässig auswertbare Information zur gewünschten Aufwärtsachse.

## Alte und neue Projekte

Projektformat 1 wird beim Öffnen in das neue Koordinatensystem umgerechnet. Position, lokale Maße, Skalierung, Meshkoordinaten und Drehung werden gemeinsam angepasst. Drehungen werden über `P * R * inverse(P)` umgerechnet; bloßes Vertauschen der Euler-Werte wäre bei kombinierten Drehungen falsch. Analytische Grundkörper werden dabei mit ihrer ursprünglichen Oberfläche in Meshdaten gesichert, damit insbesondere Kegel und Ellipsoide erhalten bleiben. Gruppenkennungen bleiben erhalten.

Neue Projektdateien und Auswahlexporte verwenden Format 2. Sie werden beim erneuten Öffnen nicht noch einmal umgerechnet. Die Quelldatei wird beim Öffnen nicht überschrieben. Format 2 benötigt 3D-Maker ab 0.1.15; ältere Versionen können es nicht öffnen.

Beispiel: Aus bisherigen lokalen Maßen `94,73 × 17 × 165 mm` werden `165 × 94,73 × 17 mm`. Die Form und Anordnung bleiben erhalten; nur die Koordinatenbasis ändert sich. Ein früherer STL-Export enthält weiterhin die damaligen Koordinaten und lässt sich nicht automatisch als Export einer bestimmten App-Version erkennen.

## Proportionales Skalieren

Über den Schlossknopf „Proportionen frei/gesperrt“ werden die lokalen Abmessungen und die Skalierungsfaktoren gekoppelt. Beispiel: Bei `40 × 40 × 12 mm` ergibt die Eingabe `Z = 24` mit geschlossenem Schloss `80 × 80 × 24 mm`. Vorhandene ungleiche Skalierungsfaktoren behalten ihr Verhältnis. Gedrehte Objekte behalten ihre Drehung und Position.

Das Schloss gilt auch beim Ziehen eines einzelnen Skalierungsgriffs und beim Skalieren einer Gruppe über ihren gemeinsamen Griff. Mit offenem Schloss bleiben die drei Achsen unabhängig. Bei Erreichen der Mindestmaße wird der gemeinsame Faktor begrenzt, damit die Proportionen erhalten bleiben. Der Schlosszustand gilt für die aktuelle Sitzung; er verändert allein noch keine Geometrie. Änderungen lassen sich rückgängig machen.

## Aktives Feld sichtbar machen

Klick oder Tastaturfokus in ein X-/Y-/Z-Feld hebt Feld und Achse mit derselben Farbe hervor. Bei Abmessungen und Skalierung werden die beiden zugehörigen lokalen Seitenflächen eingefärbt und die positive Achse angezeigt. Position zeigt eine Weltachse, Drehung die zum Euler-Wert gehörende Drehachse als Ring. Ein Texthinweis unterscheidet Weltachse, lokale Achse und proportionale Änderung. Beim Verlassen des Feldes oder Wechseln des Objekts verschwindet die Hervorhebung. Sie verändert das Mesh nicht und wird nicht exportiert.

## Validierung

- 40 Geometrie-/Integrationstests: insbesondere Migration alter Quader, Kugeln/Ellipsoide, Zylinder, Kegel und Custom-Meshes mit kombinierten Drehungen und ungleichmäßiger Skalierung. Weltkoordinaten der Oberflächenpunkte werden vor und nach der Migration verglichen; Eingabedaten und Gruppen bleiben erhalten. Format-2-Roundtrip und proportionale Mindestmaße sind geprüft.
- 26 Oberflächentests: Achsenkompass, Fokus-Hervorhebung, Boden Z=0, STL-Ausgabe, erneutes Öffnen ohne zweite Migration, proportionale Zahlenwerte, ungleiche Ausgangsskalierung, Rückgängig und einzelner Skalierungsgriff. Ein Gruppentest prüft zusätzlich, dass Abstände und Körpergrößen gemeinsam wachsen. Zusätzliche Prüfung der Schnitte entlang Welt-X, -Y und -Z an einem gedrehten Objekt.
- Bestehende Prüfungen für große STL-Dateien, Zwischenablage, Meshreparatur und beide Verschlusswerkzeuge bleiben enthalten; Kamera und Testprojektionen sind auf Z-up angepasst.
- Der native Windows-Smoke-Test prüft zusätzlich Kompass, Feldhervorhebung und proportionale Maße in der gebauten Desktop-App. Veröffentlichung erfolgt erst nach erfolgreichem Windows-Test.
