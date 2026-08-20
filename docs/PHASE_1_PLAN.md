# Phase 1 – Domänenverständnis und gemeinsame Grundlagen

Diese Datei beschreibt den ersten konkreten Umsetzungsschritt der Roadmap für LeitstellenDispo.

Wichtiger Hinweis:
- Das ist ein Vorschlag für den ersten konkreten Schritt.
- Der Fokus liegt auf der gemeinsamen Domänenmodellierung und nicht auf der vollständigen Implementierung von Spielmechanik.
- Keine technischen Annahmen werden als feste Anforderungen behandelt.
- Alle Details bleiben offen, bis Amy sie mit mir konkretisiert.

## Ziel des Schritts

Der erste konkrete Schritt ist die gemeinsame Definition der zentralen Begriffe und Beziehungen des Spiels, bevor die eigentliche Umsetzung von Wachen, Fahrzeugen, Einsätzen oder UI beginnt.

Das Ziel ist nicht, den kompletten Spielbetrieb bereits zu programmieren, sondern die Grundlage sauber zu verstehen und zu dokumentieren.

## Warum dieser Schritt jetzt sinnvoll ist

Dieser Schritt wird vor allen anderen mechanic- oder UI-lastigen Bereichen benötigt, weil alle späteren Funktionen auf denselben Grundbegriffen aufbauen:

- Was ist eine Organisation?
- Was ist eine Wache?
- Was ist ein Fahrzeug?
- Was ist ein Einsatz?
- Was ist ein Einsatzort?
- Welche Beziehungen bestehen zwischen diesen Objekten?
- Welche Daten sind für den nächsten Schritt wirklich nötig?

Ohne diese Klarheit würden spätere Phasen an unklaren Modellen hängen oder später neu überarbeitet werden müssen.

## Umfang des Schritts

Dieser erste Schritt umfasst vor allem:

- gemeinsame Begriffe definieren
- Kernobjekte identifizieren
- Beziehungen zwischen Objekten dokumentieren
- erste gemeinsame Typen/Strukturen vorbereiten
- offene Fragen und Entscheidungspunkte festhalten

Er umfasst nicht:

- vollständige Kennzahlen-Logik
- echte UI-Umsetzung
- echte Datenbank-Implementierung
- Authentifizierung
- Multiplayer
- Ausarbeitung eines kompletten Statussystems
- Umsetzung der kompletten Disposition

## Kernbegriffe, die in diesem Schritt untersucht werden

### 1. Organisation

Eine Organisation ist die übergeordnete Struktur, unter der Spielobjekte agieren.

Beispielhaft bisher genannt:
- Feuerwehr
- Rettungsdienst

Wichtig:
- Die genaue Definition von Organisationen und ihre spätere Erweiterbarkeit bleiben offen.
- Die bisher genannten Organisationen sind die bisher erwähnten Ausgangspunkte, aber keine abschließende Liste.

### 2. Wache

Eine Wache ist ein zentraler Ort, an dem Fahrzeuge stationiert sind und von dem aus sie im Spiel operieren.

Mögliche Fragen:
- Besitzt jede Wache eine Organisation?
- Kann eine Wache zu mehreren Organisationen gehören?
- Hat eine Wache einen Standort auf der Karte?
- Gibt es Wachen mit unterschiedlicher Funktion?

### 3. Fahrzeug

Ein Fahrzeug ist ein spielbares Objekt, das einer Wache zugeordnet ist und später bei Einsätzen aktiv werden kann.

Mögliche Fragen:
- Welche Attribute besitzt ein Fahrzeug?
- Welche Fahrzeugtypen gibt es?
- Welche Merkmale sind für die erste Phase nötig?
- Ist ein Fahrzeug immer einer Wache zugeordnet?

Beispiele, die bisher genannt wurden:
- LF 10
- LF 20
- RTW

Wichtig:
- Diese Beispiele sind Hinweise, keine feste Spezifikation.

### 4. Einsatz

Ein Einsatz ist eine relevante Spielinstanz, die im Leitstellenkontext bearbeitet wird.

Mögliche Fragen:
- Welche Daten braucht ein Einsatz?
- Welcher Einsatzort gehört zu einem Einsatz?
- Welche Fahrzeuge können einem Einsatz zugewiesen werden?
- Welche Kriterien entscheiden über passende Fahrzeuge?
- Welche Zustände kann ein Einsatz durchlaufen?

### 5. Einsatzort

Ein Einsatzort ist die räumliche Grundlage eines Einsatzes.

Mögliche Fragen:
- Gibt es Adressdaten?
- Gibt es Koordinaten?
- Welche Informationen sind für die erste Phase notwendig?

### 6. Einsatzarten / Stichworte

Diese Kategorien sind später relevant, aber für den ersten Schritt müssen sie noch nicht endgültig feststehen.

Wichtig:
- Die genaue Art der Einsatzarten wird erst später gemeinsam mit Amy definiert.

## Mögliche Beziehung zwischen den Objekten

Ein möglicher Überblick der Beziehung ist:

- Organisation hat mehrere Wachen
- Wache gehört zu einer Organisation
- Wache hat mehrere Fahrzeuge
- Fahrzeug gehört zu einer Wache
- Fahrzeug hat einen Typ und ggf. Fähigkeiten
- Einsatz hat einen Ort
- Einsatz benötigt ggf. bestimmte Fahrzeugtypen
- Einsatz kann Fahrzeuge zuweisen
- Fahrzeug kann in unterschiedlichen Zuständen sein

Diese Beziehungen sind ein Vorschlag zur Struktur und kein bindender Entwurf.

## Art der Dokumentation für diesen Schritt

Der erste konkrete Schritt soll dokumentarisch festhalten:

1. Welche Grundbegriffe es gibt
2. Welche Beziehungen zwischen ihnen bestehen
3. Welche Eigenschaften die Objekte vermutlich haben
4. Welche offenen Entscheidungen noch bestehen
5. Welche vergleichsweise kleinen nächsten Schritte für die Umsetzung sinnvoll wären

## Vorschlag für erste Strukturelemente

Es ist sinnvoll, zunächst nur die tragenden Objekte und ihre wichtigsten Eigenschaften zu definieren, ohne bereits komplette Feature-Logik zu bauen.

### Vorschlag für ein minimales Domänenmodell

- Organisation
  - id
  - name
  - type
  - optional: metadata

- Wache
  - id
  - name
  - organisationId
  - position
  - optional: status

- Fahrzeug
  - id
  - name
  - type
  - organisationId
  - wacheId
  - status
  - optional: capabilities

- Einsatz
  - id
  - type
  - location
  - priority
  - status
  - assignedVehicleIds

- Einsatzort
  - id
  - label
  - coordinates
  - optional: region

Diese Felder sind nur ein Vorschlag zur Struktur und keine feste Spezifikation.

## Was in diesem Schritt nicht endgültig festgelegt werden darf

Folgende Themen müssen bewusst offen bleiben:

- exakte Bedeutung des Statussystems 1–6
- genaue Fahrzeugfähigkeiten und Fahrzeugtypen
- genaue Einsatzarten und Stichwörter
- Authentifizierung
- Datenbankstrategie
- UI-Design
- Routen-/Fahrzeitenlogik
- Mehrbenutzerfunktionen
- Rollen und Berechtigungen

## Mögliche offene Entscheidungen für Phase 1

Einige Entscheidungen müssen mit Amy geklärt werden, bevor der nächste Schritt konkret umgesetzt wird:

1. Soll die Domänenmodellierung zunächst nur auf die Grundobjekte (Organisation, Wache, Fahrzeug, Einsatz, Einsatzort) fokussieren oder auch auf spätere erweiterbare Metadaten und Fähigkeiten?
2. Soll der erste Schritt eher als reine Dokumentation/Modellbeschreibung erfolgen oder als vorbereitende Typdefinition im shared-Paket?
3. Wie detailliert sollen die ersten Typen in shared sein?
4. Soll die erste Domänenmodellierung die Spielwelt möglichst generisch halten, damit spätere Organisationen leicht ergänzt werden können?
5. Wie viel Detailgenauigkeit im Objektmodell ist für den ersten technisch nutzbaren Schritt sinnvoll?

## Nächster realistischer Schritt nach Phase 1

Nach dieser Phase wäre der natürliche nächste Schritt:

- die definierten Domänenobjekte in die gemeinsame Typ- und Modellstruktur aufnehmen
- die Beziehung zwischen den Objekten im Server- und Client-Kontext sauber dokumentieren
- anschließend eine erste kleine, überprüfbare Datenbasis für Organisations-, Wachen- und Fahrzeugobjekte vorbereiten

Wichtig:
- Das ist nur der nächste sinnvolle Schritt nach der Domänenmodellierung.
- Nicht mehrere große Schritte gleichzeitig.

## Checkliste für die Vollständigkeit dieses Schritts

Dieser Schritt gilt als vollständig vorbereitet, wenn:

- zentrale Begriffe klar dokumentiert sind
- Beziehungen zwischen Objekten sichtbar sind
- offene Fragen gesammelt sind
- keine unklaren Annahmen als festgelegt gelten
- die nächsten Schritte logisch aus diesem Modell hervorgehen
- Amy die Richtung bestätigt hat

## Abschluss

Phase 1 dient als Grundlage für alles Folgende. Es ist der Schritt, in dem das Projekt seine gemeinsame Sprache entwickelt, bevor konkrete Spielmechanik, UI und Logik aufgesetzt werden.

Damit bleibt die Architektur flexibel und die spätere Umsetzung kann auf klaren und überprüfbaren Grundlagen aufbauen.
