# 0.1.13 – Armloch und Durchgang mit Materialstärke verschließen

## Warum der bisherige Marker nicht genügte

Der Rand-Modus aus 0.1.12 sucht Kanten, die nur an einem Dreieck liegen. Ein modelliertes Armloch mit Innenwand und Materialstärke ist dagegen ein Durchgang durch ein Volumen. An seiner sichtbaren Kante liegt kein offener Mesh-Rand. Umkreisen konnte diesen Fall deshalb nicht auswählen. Der neue Modus arbeitet mit einer frei markierten Verschlussfläche und einer echten Volumenvereinigung.

## Bedienung

1. Genau ein Objekt auswählen. Rechts **Armloch / Durchgang schließen** öffnen. Derselbe Modus ist auch über einen Button im alten Löcherwerkzeug erreichbar.
2. Ansicht so drehen, dass die gewünschte Öffnung gut sichtbar ist. Im Werkzeug dreht Rechtsziehen die Ansicht, das Mausrad zoomt. Bei Bedarf das Werkzeugpanel einklappen.
3. Mit gedrückter linker Maustaste die Öffnung vollständig umfahren. **Die Linie auf dem Material knapp außerhalb der Öffnung zeichnen**, nicht durch die Luft oder auf der gegenüberliegenden Innenwand. Die Markierung wird auf die tatsächliche Mesh-Oberfläche übertragen und orange angezeigt.
4. Dicke, Überlappung und Wölbung einstellen. Für das geprüfte Westenmodell funktionierten **1,5 mm Dicke, 0,8 mm Überlappung, 0 mm Wölbung**. Die Werte sind lokal zum Objekt; eine vorhandene Objektskalierung wirkt zusätzlich darauf.
5. **Vorschau berechnen**. Eine grüne Verschlussfläche erscheint nur nach erfolgreicher Vereinigung und topologischer Prüfung. Von mehreren Seiten prüfen.
6. **Verschluss übernehmen**. Erst jetzt wird das Original ersetzt. **Abbrechen/Esc** verwirft die Berechnung; **Strg+Z** macht das Übernehmen rückgängig. Anschließend als Projekt oder über **Auswahl als STL** speichern.

„Löcher markieren & schließen“ bleibt für echte offene Mesh-Ränder verfügbar. Der neue Modus ersetzt diese Funktion nicht.

## Geometrie

- Der Marker liefert 32 auf der Oberfläche liegende 3D-Punkte. Fehlende Treffer und deutliche Sprünge auf eine Rückwand werden abgewiesen.
- Aus der Kontur entsteht ein geschlossener Verschlusskörper. Überlappung erweitert die Kontur in ihrer Ebene, damit zwischen Markersegmenten und gekrümmtem Rand keine schmalen Restspalten bleiben.
- Vorder- und Rückseite verwenden **dieselbe Triangulation**, entlang der mittleren Flächennormalen gegeneinander versetzt. Unabhängig triangulierte, nicht ebene Kappen könnten sich sonst kreuzen und trotz nomineller Dicke extrem dünne Stellen erzeugen. Ein eigener Volumentest prüft diesen Fall. Zur eingestellten Dicke nach innen kommen 0,15 mm Überstand nach außen.
- Die Vereinigung erfolgt im Hintergrund mit **Manifold 3.5.5 (WASM)**. Die WASM-Daten sind im Worker eingebettet, sodass auch die portable App ohne Netzverbindung arbeitet.
- Lose, nicht ausreichend überlappende oder vollständig im vorhandenen Material liegende Körper werden nicht als erfolgreicher Verschluss akzeptiert. Die topologische Kennzahl muss eine verringerte Zahl von Durchgängen anzeigen. Bei mehr als einem angezeigten geschlossenen Durchgang die Markierung prüfen und ggf. enger setzen.
- Erst nach gültiger Vorschau ist Übernehmen möglich. Neue Parameter oder eine neue Markierung verwerfen das vorige Ergebnis.

## Lokale Bereinigung beschädigter STL-Oberflächen

Das geprüfte Referenzmodell hatte 477.335 Dreiecke, 24 offene und 25 nicht-manifolde Kanten; diese kleinen Fehler waren nicht die sichtbare Armöffnung. Eine robuste Volumenvereinigung benötigt eine geschlossene Ausgangsoberfläche.

Die abschaltbare Option **Kleine Meshfehler lokal bereinigen** entfernt nur Flächen an problematischen Kanten beziehungsweise verzweigten Randstellen. Kleine entstehende Randzyklen werden räumlich ergänzt. Die übrigen Koordinaten bleiben in der Vorbereitung stehen. Keine globale Voxel-Neuberechnung und keine pauschale Modellvereinfachung.

Schutzgrenzen: höchstens 1 % der Ausgangsdreiecke (bei sehr kleinen Modellen mindestens 100), maximal fünf Bereinigungsschritte, Randzyklen höchstens 128 Punkte und maximal 12 % der Modelldiagonale Umfang. Größere offene Konturen oder nicht eindeutig reparierbare Topologie führen zum Abbruch. Die Statistik bleibt vor dem Übernehmen sichtbar. Diese Option kann kleine offene Fehlstellen außerhalb der Markierung schließen und ist deshalb ausdrücklich abschaltbar.

Am lokalen Referenzmodell wurden 224 Flächen ersetzt und 13 kleine Fehlstellen geschlossen. Die Volumenänderung allein durch diese Vorbereitung betrug ungefähr 0,022 mm³. Die anschließende Vereinigung darf angrenzende Flächen neu triangulieren; Normalen werden wie bisher neu berechnet.

## Geschwindigkeit und Tests

- Die Marker-Suche nutzt eine einmal aufgebaute, wiederverwendbare BVH und fragt nur den ersten Oberflächentreffer ab. Die Kameramatrix wird für die Übertragung der ganzen Markierung festgehalten.
- Die vorbereitete Volumengeometrie bleibt für weitere Vorschauen im Worker erhalten. Abbrechen beendet den Worker.
- 35 Unit-/Desktop-/Geometrietests und 20 Browsertests erfolgreich. Geprüft werden echte dickwandige Durchgänge, unveränderte andere Öffnungen im Querschnitt, lose/falsch platzierte Verschlüsse, nicht ebene Konturen und Wanddicke, lokale Topologiebereinigung, Marker, Vorschau, Speichern, Undo/Redo und Abbruch.
- Browser-Regressionen laufen gegen den Produktionsbuild. Damit werden auch die gebündelten WASM-Worker geprüft und keine durch Dev-Abhängigkeitsoptimierung ausgelösten Seitenreloads mit Produktfehlern verwechselt.
- Das bereitgestellte große Referenzmodell wurde zusätzlich **lokal** im Produktionsbuild vom Markieren bis zum Projekt-Export geprüft. Wieder eingelesene STL: geschlossene Kanten, konsistente Orientierung; markiertes Armloch geschlossen, anderes Armloch, Hals und Unterseite in unabhängigen Prüfstrahlen offen. Gesamtmaße unverändert. Die hochgeladene Geometrie wird weder eingecheckt noch veröffentlicht; öffentliche Regressionen verwenden selbst erzeugte Modelle.
- Der Windows-Smoke-Test startet die gepackte App und prüft zusätzlich einen markierten dickwandigen Durchgang einschließlich offline geladenem WASM-Worker.

## Grenzen

Dies ist keine automatische Erkennung aller Kleidungsöffnungen und keine Rekonstruktion einer unbekannten ursprünglichen Kleidungsform. Die Markierung muss auf dem gewünschten Material liegen; verdeckte, stark gefaltete oder überlappende Konturen können abgewiesen werden. Die Wölbung passt eine neue Fläche an die Kontur an, ersetzt aber keine manuelle Prüfung auf Kollisionen mit weit entfernten Modellteilen. Allgemein beschädigte oder nicht volumenfähige Dateien können eine weitergehende Reparatur erfordern. Auf sehr großen Modellen benötigen Vorbereitung, BVH-Aufbau, Ausgabe und Rendering weiterhin Zeit und Speicher.
