/**
 * Härtetest („kann man das Spiel kaputt machen?“).
 *
 * Wirft den reinen Spielfunktionen absichtlich kaputte und bösartige Daten hin –
 * so wie es ein manipulierter Client gegen einen späteren Server tun könnte – und
 * prüft, ob sie damit umgehen (ohne abzustürzen). Jede Funktion, die bei Mülldaten
 * eine Ausnahme wirft, ist ein echter Robustheits-/Sicherheitsbefund: Auf einem
 * Server könnte so eine Eingabe im schlimmsten Fall die Anfrage (oder den Prozess)
 * zum Absturz bringen.
 *
 * Reiner Test – verändert keinen echten Spielstand.
 */
import { alarmiere, kaufeFahrzeug, erstelleWache } from '../aktionen.js';
import { erstelleAlarmVorschlag } from '../alarmierung.js';
import { berechneSpielTick } from '../spielTick.js';
import { migriereSpielstand, createNeuesSpiel, type Spielstand } from '../spielstand.js';
import { pruefeSpielstand } from './fehlerwaechter.js';
import { erzeugeZufall, zufallsElement, zufallsZahl, type Zufall } from '../zufall.js';

export interface HaerteTestOptionen {
  /** Startwert für reproduzierbare Läufe. */
  seed?: number;
  /** Anzahl zufälliger Angriffe (zusätzlich zu den festen Fällen). Standard 500. */
  versuche?: number;
}

export interface HaerteTestFund {
  bereich: string;
  eingabe: string;
  fehler: string;
}

export interface HaerteTestErgebnis {
  versuche: number;
  /** Funktionen, die bei Mülldaten eine Ausnahme geworfen haben – zu behebende Befunde. */
  abstuerze: HaerteTestFund[];
  /** Eingaben, die sauber (ohne Absturz) abgewiesen/verarbeitet wurden. */
  sauberVerarbeitet: number;
}

/** Eine Auswahl „böser“ Werte, die typische Annahmen im Code verletzen. */
const BOESE_WERTE: unknown[] = [
  undefined, null, NaN, Infinity, -Infinity, 0, -1, -999999, 1e308,
  '', 'nope', '123', {}, [], true, false,
  { length: 3 }, () => 0, Symbol('x'),
];

const boese = (zufall: Zufall): unknown => zufallsElement(zufall, BOESE_WERTE);

/** Baut einen gültigen Spielstand und ersetzt zufällige Felder durch böse Werte. */
function baueBoesenSpielstand(zufall: Zufall): unknown {
  const basis: any = JSON.parse(JSON.stringify(createNeuesSpiel(new Date(1_700_000_000_000))));
  const felder = ['version', 'balance', 'transactions', 'locations', 'vehicles', 'incidents', 'completedIncidentHistory', 'krankenhaeuser', 'gespeichertAm'];
  const anzahl = zufallsZahl(zufall, 1, 3);
  for (let i = 0; i < anzahl; i += 1) {
    const feld = zufallsElement(zufall, felder)!;
    basis[feld] = boese(zufall);
  }
  // Manchmal ein kaputtes Fahrzeug / einen kaputten Einsatz einschleusen
  if (Array.isArray(basis.vehicles) && zufall() < 0.5) {
    basis.vehicles = [...basis.vehicles, { id: boese(zufall), price: boese(zufall), besatzung: boese(zufall), type: boese(zufall) }];
  }
  if (Array.isArray(basis.incidents) && zufall() < 0.5) {
    basis.incidents = [{ id: 'kaputt', status: boese(zufall), alarmedVehicles: boese(zufall), coords: boese(zufall), requiredVehicles: boese(zufall), createdAt: boese(zufall) }];
  }
  return basis;
}

/** Führt eine Funktion aus und meldet eine geworfene Ausnahme als Befund. */
function versuche(funde: HaerteTestFund[], bereich: string, eingabe: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    funde.push({ bereich, eingabe, fehler: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Führt den Härtetest aus: feste kritische Fälle plus viele zufällige Angriffe.
 * Liefert alle gefundenen Abstürze (idealerweise keine).
 */
export function haerteTest(optionen: HaerteTestOptionen = {}): HaerteTestErgebnis {
  const zufall = erzeugeZufall(optionen.seed ?? 1);
  const versucheAnzahl = optionen.versuche ?? 500;
  const funde: HaerteTestFund[] = [];
  const gueltig = createNeuesSpiel(new Date(1_700_000_000_000));
  let sauber = 0;
  const zaehle = () => { sauber += 1; };

  // --- Feste, besonders kritische Fälle (Migration von Mülldaten) ---
  for (const wert of BOESE_WERTE) {
    versuche(funde, 'migration', `migriereSpielstand(${beschreibe(wert)})`, () => { migriereSpielstand(wert); zaehle(); });
  }
  versuche(funde, 'migration', 'migriereSpielstand("{...kaputtes JSON-Objekt}")', () => {
    migriereSpielstand({ version: 3, locations: 'nein', vehicles: null, incidents: 42 } as any);
    zaehle();
  });

  // --- Zufällige Angriffe auf die echten Angriffsflächen eines späteren Servers ---
  for (let i = 0; i < versucheAnzahl; i += 1) {
    const ziel = zufallsZahl(zufall, 0, 3);

    if (ziel === 0) {
      // Grenze: ein manipulierter/importierter Spielstand. Darf nie abstürzen.
      const boeserStand = baueBoesenSpielstand(zufall);
      versuche(funde, 'migration', 'migriereSpielstand(boeserStand)', () => {
        const geladen = migriereSpielstand(boeserStand);
        zaehle();
        // Was die Grenze passiert, muss der Tick & der Fehlerwächter ohne Absturz verarbeiten
        if (geladen) {
          berechneSpielTick(
            { vehicles: geladen.vehicles, incidents: geladen.incidents, locations: geladen.locations, krankenhaeuser: geladen.krankenhaeuser },
            zufallsZahl(zufall, 0, 2e12),
          );
          pruefeSpielstand(geladen);
          if (geladen.incidents[0]) {
            erstelleAlarmVorschlag(geladen.incidents[0], { incidents: geladen.incidents, vehicles: geladen.vehicles, locations: geladen.locations });
          }
        }
      });
    } else if (ziel === 1) {
      // Alarm-Anfrage mit beliebigen (auch unsinnigen) Parametern auf gültigem Spielstand
      const incidentId = String(boese(zufall));
      const vehicleIds = boese(zufall) as any;
      versuche(funde, 'alarm', `alarmiere(gültig, ${beschreibe(incidentId)}, ${beschreibe(vehicleIds)})`, () => {
        alarmiere(gueltig, incidentId, Array.isArray(vehicleIds) ? vehicleIds.map(String) : [String(vehicleIds)], zufallsZahl(zufall, 0, 2e12));
        zaehle();
      });
    } else if (ziel === 2) {
      // Kauf-Anfrage mit beliebigen Parametern
      const stationId = String(boese(zufall));
      const typ = String(boese(zufall));
      versuche(funde, 'kauf', `kaufeFahrzeug(gültig, ${beschreibe(stationId)}, ${beschreibe(typ)})`, () => {
        kaufeFahrzeug(gueltig, stationId, typ);
        zaehle();
      });
    } else {
      // Fehlerwächter als Diagnose-Werkzeug: muss selbst mit Mülldaten standhalten
      const boeserStand = baueBoesenSpielstand(zufall) as Spielstand;
      versuche(funde, 'fehlerwaechter', 'pruefeSpielstand(boeserStand)', () => { pruefeSpielstand(boeserStand); zaehle(); });
    }
  }

  return { versuche: versucheAnzahl, abstuerze: funde, sauberVerarbeitet: sauber };
}

const beschreibe = (wert: unknown): string => {
  if (wert === undefined) return 'undefined';
  if (wert === null) return 'null';
  if (typeof wert === 'function') return 'function';
  if (typeof wert === 'symbol') return 'symbol';
  if (Array.isArray(wert)) return `[${wert.length} Elemente]`;
  if (typeof wert === 'object') return '{Objekt}';
  return JSON.stringify(wert) ?? String(wert);
};
