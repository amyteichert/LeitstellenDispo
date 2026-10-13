/**
 * Härtetest („kann man das Spiel/den Server kaputt machen?“).
 *
 * Wirft den reinen Spielfunktionen absichtlich kaputte und bösartige Daten hin – so wie es ein
 * manipulierter Client gegen den Server tun könnte (der Server speichert Spielstände und validiert
 * sie mit `migriereSpielstand`) – und prüft, ob etwas abstürzt. Jede geworfene Ausnahme ist ein
 * echter Robustheits-/Sicherheitsbefund. Reiner Test, verändert keinen echten Spielstand.
 */
import { alarmiereFahrzeuge, erstelleAlarmVorschlag } from '../alarmierung.js';
import { berechneSpielTick } from '../spielTick.js';
import { migriereSpielstand, createNeuesSpiel, type Spielstand } from '../spielstand.js';
import { pruefeSpielstand } from './fehlerwaechter.js';
import { erzeugeZufall, zufallsElement, zufallsZahl, type Zufall } from './zufall.js';

export interface HaerteTestOptionen {
  seed?: number;
  versuche?: number;
}

export interface HaerteTestFund {
  bereich: string;
  eingabe: string;
  fehler: string;
}

export interface HaerteTestErgebnis {
  versuche: number;
  abstuerze: HaerteTestFund[];
  sauberVerarbeitet: number;
}

const BOESE_WERTE: unknown[] = [
  undefined, null, NaN, Infinity, -Infinity, 0, -1, -999999, 1e308,
  '', 'nope', '123', {}, [], true, false, { length: 3 }, () => 0, Symbol('x'),
];

const boese = (zufall: Zufall): unknown => zufallsElement(zufall, BOESE_WERTE);

function baueBoesenSpielstand(zufall: Zufall): unknown {
  const basis: any = JSON.parse(JSON.stringify(createNeuesSpiel(new Date(1_700_000_000_000))));
  const felder = ['version', 'balance', 'transactions', 'locations', 'vehicles', 'incidents', 'completedIncidentHistory', 'krankenhaeuser', 'personal', 'ruf', 'funk', 'gespeichertAm'];
  const anzahl = zufallsZahl(zufall, 1, 3);
  for (let i = 0; i < anzahl; i += 1) basis[zufallsElement(zufall, felder)!] = boese(zufall);
  if (Array.isArray(basis.vehicles) && zufall() < 0.5) {
    basis.vehicles = [...basis.vehicles, { id: boese(zufall), price: boese(zufall), besatzung: boese(zufall), type: boese(zufall) }];
  }
  if (Array.isArray(basis.incidents) && zufall() < 0.5) {
    basis.incidents = [{ id: 'kaputt', status: boese(zufall), alarmedVehicles: boese(zufall), coords: boese(zufall), requiredVehicles: boese(zufall), createdAt: boese(zufall) }];
  }
  return basis;
}

function versuche(funde: HaerteTestFund[], bereich: string, eingabe: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    funde.push({ bereich, eingabe, fehler: error instanceof Error ? error.message : String(error) });
  }
}

export function haerteTest(optionen: HaerteTestOptionen = {}): HaerteTestErgebnis {
  const zufall = erzeugeZufall(optionen.seed ?? 1);
  const versucheAnzahl = optionen.versuche ?? 500;
  const funde: HaerteTestFund[] = [];
  const gueltig = createNeuesSpiel(new Date(1_700_000_000_000));
  let sauber = 0;
  const zaehle = () => { sauber += 1; };

  // Feste kritische Fälle: Migration von Mülldaten
  for (const wert of BOESE_WERTE) {
    versuche(funde, 'migration', `migriereSpielstand(${beschreibe(wert)})`, () => { migriereSpielstand(wert); zaehle(); });
  }
  versuche(funde, 'migration', 'migriereSpielstand({kaputtes Objekt})', () => {
    migriereSpielstand({ version: 5, locations: 'nein', vehicles: null, incidents: 42, balance: 'x' } as any);
    zaehle();
  });

  for (let i = 0; i < versucheAnzahl; i += 1) {
    const ziel = zufallsZahl(zufall, 0, 2);

    if (ziel === 0) {
      const boeserStand = baueBoesenSpielstand(zufall);
      versuche(funde, 'migration', 'migriereSpielstand(boeserStand)', () => {
        const geladen = migriereSpielstand(boeserStand);
        zaehle();
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
      const incidentId = String(boese(zufall));
      const vehicleIds = boese(zufall) as any;
      versuche(funde, 'alarm', `alarmiereFahrzeuge(gültig, ${beschreibe(incidentId)}, ${beschreibe(vehicleIds)})`, () => {
        alarmiereFahrzeuge(
          { incidents: gueltig.incidents, vehicles: gueltig.vehicles, locations: gueltig.locations },
          incidentId,
          Array.isArray(vehicleIds) ? vehicleIds.map(String) : [String(vehicleIds)],
          zufallsZahl(zufall, 0, 2e12),
        );
        zaehle();
      });
    } else {
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
