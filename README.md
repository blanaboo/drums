# Drums

Web-App zum Schlagzeug-Lernen mit Schwerpunkt **Unabhängigkeit der Gliedmaßen**. Eine Gliedmaße spielt ein
gleichmäßiges Muster (Ostinato), die anderen kommen nacheinander dazu – mit Noten, farbigem Gliedmaßen-Raster und
synthetischer Begleitspur zum Mitspielen. Optimiert fürs iPad, läuft in jedem aktuellen Browser.

**App:** <https://blanaboo.github.io/drums/>

## Auf dem iPad einrichten

1. Die Adresse oben in Safari öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm"**. Ab dann die App immer über das Symbol starten: Sie läuft dann
   im Vollbild, auch offline, und der Fortschritt bleibt erhalten. (Safari löscht Website-Daten nach 7 Tagen
   ohne Besuch, die Home-Bildschirm-App hat ihren eigenen Speicher.)
3. Kopfhörer mit Kabel oder eine Box anschließen – gegen ein akustisches Set kommen die iPad-Lautsprecher kaum an.
   Bei Bluetooth hinkt der Ton etwas hinterher, dann unter *Einstellungen → Bild-Versatz* ausgleichen.

## So übst du

- **Reihenfolge:** 6 Stufen, 34 Übungen – von „Achtel auf der HiHat" bis zu Fills in 16teln. Nichts ist gesperrt,
  die Übersicht schlägt die nächste Übung vor.
- **Aufbau-Modus:** Alle 4 Takte (einstellbar) kommt eine Gliedmaße dazu. Was noch nicht dran ist, ist ausgegraut
  und still; einen Takt vorher erscheint „Gleich dazu: …".
- **Stummschalten:** Im Raster auf eine Gliedmaße tippen nimmt sie aus der Begleitspur – so spielst du sie allein.
- **Tempo-Treppe:** erhöht das Tempo alle N Durchläufe um +5 BPM bis zum Zieltempo der Übung.
- **„Geschafft bei … BPM":** speichert dein bestes Tempo. Ab dem Zieltempo gilt die Übung als geschafft.
- Leertaste = Start/Stopp (mit Tastatur).

### Notenlegende

| Instrument | Note | Raster |
|---|---|---|
| Crash | x auf der Hilfslinie über dem System | Cr |
| HiHat (Hand) | x über dem System, „○" = offen | HH, HH○ |
| Ride | x auf der obersten (5.) Linie | Ri |
| Tom 1 / Tom 2 | oberster Zwischenraum / 4. Linie | T1 / T2 |
| Snare | 3. Zwischenraum, (eingeklammert) = Ghost Note | SD, (SD) |
| Standtom | 2. Zwischenraum | ST |
| Bassdrum | 1. Zwischenraum | BD |
| HiHat-Pedal | x unter dem System | Ped |

Hände stehen mit Hals nach oben, Füße mit Hals nach unten. „>" = Akzent.

## Übungen ergänzen

Übungen stehen in [`js/curriculum.js`](js/curriculum.js), eine Zeichenkette pro Gliedmaße, ein Zeichen pro Rasterschritt:

```js
{ id: '2.2', title: 'Rock-Grundbeat', steps: 8, bars: 1, tempo: { start: 60, target: 100 },
  lanes: { RH: 'hhhhhhhh', LH: '..s...s.', RF: 'k...k...' },
  build: ['RH', 'RF', 'LH'], tip: '…' }
```

`h` HiHat · `o` HiHat offen · `r` Ride · `c` Crash · `s` Snare · `g` Ghost Note · `1`/`2`/`3` Toms ·
`k` Bassdrum · `f` HiHat-Pedal · `.` Pause · Großbuchstabe = Akzent · `|` Taktstrich (wird ignoriert).
`steps` = 8 (Achtel) oder 16 (Sechzehntel) pro 4/4-Takt, `build` = Reihenfolge im Aufbau-Modus.

## Entwicklung

Kein Build-Schritt: Vanilla-JavaScript mit ES-Modulen, VexFlow 4.2.5 liegt unter `vendor/`.

```powershell
# Lokaler Server (JDK 18+ bringt jwebserver mit)
jwebserver -b 127.0.0.1 -p 8080 -d C:\Users\rober\dev\drums
# Fürs iPad im WLAN stattdessen -b 0.0.0.0 und http://<PC-IP>:8080 öffnen (ohne HTTPS: kein Offline-Modus)

# Tests in Headless-Edge (Unit-Tests, Notensatz aller Übungen, Offline-Audio-Render)
powershell -File tools\headless.ps1
# End-to-End: echte Wiedergabe mit Einzählen, Abspielmarke und Aufbau-Modus
powershell -File tools\headless.ps1 -Url 'http://127.0.0.1:8080/#/uebung/2.2' -ExprFile tests\e2e-playback.js
```

Veröffentlicht wird über GitHub Pages direkt aus `main`. Nächste Schritte: [docs/roadmap.md](docs/roadmap.md).
