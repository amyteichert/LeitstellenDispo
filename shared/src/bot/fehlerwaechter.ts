/**
 * Fehlerwächter: prüft einen Spielstand auf Invarianten, die im normalen Spiel
 * niemals verletzt sein dürfen. Reine, defensiv geschriebene Prüffunktion –
 * sie darf selbst mit beschädigten Daten niemals abstürzen.
 */
import { getAktiveZuteilungen, EINSATZ_STATUS_LABELS } from '../daten.js';
import type { SpielEinsatz } from '../daten.js';
import type { Spielstand } from '../spielstand.js';

export type ProblemSchwere = 'fehler' | 'warnung';

export interface Problem {
  schwere: ProblemSchwere;
  code: string;
  text: string;
}

/** Nach wie langer Zeit (ms) ein laufender Einsatz als „hängt fest“ gilt. */
const FESTHAENGER_MS = 60 * 60 * 1000;

const EINSATZ_STATUS = new Set(Object.keys(EINSATZ_STATUS_LABELS));

export function pruefeSpielstand(spielstand: Spielstand, jetzt: number = Date.now()): Problem[] {
  const probleme: Problem[] = [];
  const fehler = (code: string, text: string) => probleme.push({ schwere: 'fehler', code, text });
  const warnung = (code: string, text: string) => probleme.push({ schwere: 'warnung', code, text });
  const s = (wert: unknown): string => {
    try { return typeof wert === 'symbol' ? wert.toString() : String(wert); } catch { return '?'; }
  };

  if (!spielstand || typeof spielstand !== 'object') {
    return [{ schwere: 'fehler', code: 'spielstand-ungueltig', text: 'Spielstand ist kein Objekt' }];
  }
  const vehicles = Array.isArray(spielstand.vehicles) ? spielstand.vehicles : [];
  const incidents = Array.isArray(spielstand.incidents) ? spielstand.incidents : [];
  const locations = Array.isArray(spielstand.locations) ? spielstand.locations : [];
  if (!Array.isArray(spielstand.vehicles)) fehler('vehicles-kein-array', 'Fahrzeugliste ist kein Array');
  if (!Array.isArray(spielstand.incidents)) fehler('incidents-kein-array', 'Einsatzliste ist kein Array');
  if (!Array.isArray(spielstand.locations)) fehler('locations-kein-array', 'Standortliste ist kein Array');

  // --- Kontostand ---
  if (!Number.isFinite(spielstand.balance)) {
    fehler('balance-nan', `Kontostand ist keine gültige Zahl: ${s(spielstand.balance)}`);
  } else if (spielstand.balance < 0) {
    warnung('balance-negativ', `Kontostand ist negativ: ${s(spielstand.balance)} € (durch laufende Kosten möglich)`);
  }

  // --- Ruf ---
  if (spielstand.ruf !== undefined && (!Number.isFinite(spielstand.ruf) || spielstand.ruf < 0 || spielstand.ruf > 100)) {
    fehler('ruf-ungueltig', `Ruf liegt außerhalb von 0–100: ${s(spielstand.ruf)}`);
  }

  // --- Fahrzeuge ---
  const fahrzeugIds = new Set<string>();
  for (const vehicle of vehicles) {
    if (!vehicle || typeof vehicle !== 'object') continue;
    if (fahrzeugIds.has(vehicle.id)) fehler('fahrzeug-doppelt', `Fahrzeug-ID kommt doppelt vor: ${s(vehicle.id)}`);
    fahrzeugIds.add(vehicle.id);
    if (vehicle.stationId && !locations.some((location) => location?.id === vehicle.stationId)) {
      warnung('fahrzeug-ohne-wache', `Fahrzeug ${s(vehicle.callsign ?? vehicle.id)} verweist auf eine gelöschte Wache (${s(vehicle.stationId)})`);
    }
  }

  // --- Personal (falls vorhanden) ---
  if (spielstand.personal !== undefined && !Array.isArray(spielstand.personal)) {
    fehler('personal-kein-array', 'Personalliste ist kein Array');
  } else if (Array.isArray(spielstand.personal)) {
    for (const person of spielstand.personal) {
      if (person?.fahrzeugId && !fahrzeugIds.has(person.fahrzeugId)) {
        warnung('person-ohne-fahrzeug', `Mitarbeiter ${s(person.name ?? person.id)} ist einem nicht existierenden Fahrzeug zugeteilt (${s(person.fahrzeugId)})`);
      }
    }
  }

  // --- Einsätze ---
  const fahrzeugZuEinsatz = new Map<string, string>();
  for (const incident of incidents) {
    if (!incident || typeof incident !== 'object') continue;
    if (!EINSATZ_STATUS.has(incident.status)) {
      fehler('einsatz-status-ungueltig', `Einsatz ${s(incident.id)} hat einen unbekannten Status: ${s(incident.status)}`);
    }
    const zuteilungen = Array.isArray(incident.alarmedVehicles) ? getAktiveZuteilungen(incident) : [];
    for (const zuteilung of zuteilungen) {
      if (!fahrzeugIds.has(zuteilung.vehicleId)) {
        fehler('zuteilung-ohne-fahrzeug', `Einsatz ${s(incident.id)} ist ein nicht existierendes Fahrzeug zugeteilt: ${s(zuteilung.vehicleId)}`);
      }
      if (incident.status !== 'abgeschlossen') {
        const anderer = fahrzeugZuEinsatz.get(zuteilung.vehicleId);
        if (anderer && anderer !== incident.id) {
          fehler('fahrzeug-doppelt-alarmiert', `Fahrzeug ${s(zuteilung.vehicleId)} ist gleichzeitig zwei laufenden Einsätzen zugeteilt (${s(anderer)} und ${s(incident.id)})`);
        } else {
          fahrzeugZuEinsatz.set(zuteilung.vehicleId, incident.id);
        }
      }
    }
    if (istFesthaenger(incident, jetzt)) {
      warnung('einsatz-haengt', `Einsatz ${s(incident.id)} (${s(incident.stichwort)}) läuft seit über einer Stunde Spielzeit, ohne abzuschließen`);
    }
  }

  return probleme;
}

function istFesthaenger(incident: SpielEinsatz, jetzt: number): boolean {
  const laufend = incident.status === 'alarmiert' || incident.status === 'in_bearbeitung' || incident.status === 'transport';
  return laufend && Number.isFinite(incident.createdAt) && jetzt - incident.createdAt > FESTHAENGER_MS;
}

export const nurFehler = (probleme: Problem[]): Problem[] => probleme.filter((problem) => problem.schwere === 'fehler');
