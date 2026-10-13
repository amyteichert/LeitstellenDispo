/**
 * Fehlerwächter: prüft einen Spielstand auf Invarianten, die im normalen Spiel
 * niemals verletzt sein dürfen. Findet so Bugs (oder manipulierte Spielstände),
 * bevor sie Spieler bemerken.
 *
 * Reine Prüffunktion – verändert nichts.
 */
import { getAktiveZuteilungen, EINSATZ_STATUS_LABELS, type SpielEinsatz } from '../daten.js';
import type { Spielstand } from '../spielstand.js';

export type ProblemSchwere = 'fehler' | 'warnung';

export interface Problem {
  schwere: ProblemSchwere;
  /** Maschinenlesbarer Code, z. B. 'balance-nan' */
  code: string;
  text: string;
}

/** Nach wie langer Zeit (ms) ein laufender Einsatz als „hängt fest“ gilt. */
const FESTHAENGER_MS = 60 * 60 * 1000;

const EINSATZ_STATUS = new Set(Object.keys(EINSATZ_STATUS_LABELS));

/** Prüft einen Spielstand und liefert alle gefundenen Probleme (leer = alles in Ordnung). */
export function pruefeSpielstand(spielstand: Spielstand, jetzt: number = Date.now()): Problem[] {
  const probleme: Problem[] = [];
  const fehler = (code: string, text: string) => probleme.push({ schwere: 'fehler', code, text });
  const warnung = (code: string, text: string) => probleme.push({ schwere: 'warnung', code, text });
  // Sichere Umwandlung in Text (Symbols o. Ä. würden eine Template-String-Ausnahme werfen)
  const s = (wert: unknown): string => {
    try { return typeof wert === 'symbol' ? wert.toString() : String(wert); } catch { return '?'; }
  };

  // Diagnose-Werkzeug: niemals abstürzen, auch bei beschädigten Daten
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
    fehler('balance-negativ', `Kontostand ist negativ: ${s(spielstand.balance)} € (Aktionen sollten das verhindern)`);
  }

  // --- Fahrzeuge ---
  const fahrzeugIds = new Set<string>();
  for (const vehicle of vehicles) {
    if (!vehicle || typeof vehicle !== 'object') continue;
    if (fahrzeugIds.has(vehicle.id)) {
      fehler('fahrzeug-doppelt', `Fahrzeug-ID kommt doppelt vor: ${s(vehicle.id)}`);
    }
    fahrzeugIds.add(vehicle.id);
    if (vehicle.besatzung !== undefined && (!Number.isFinite(vehicle.besatzung) || vehicle.besatzung < 0)) {
      fehler('besatzung-ungueltig', `Fahrzeug ${s(vehicle.callsign ?? vehicle.id)} hat eine ungültige Besatzung: ${s(vehicle.besatzung)}`);
    }
    if (vehicle.stationId && !locations.some((location) => location?.id === vehicle.stationId)) {
      warnung('fahrzeug-ohne-wache', `Fahrzeug ${s(vehicle.callsign ?? vehicle.id)} verweist auf eine gelöschte Wache (${s(vehicle.stationId)})`);
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

/** Läuft ein alarmierter/in Bearbeitung befindlicher Einsatz ungewöhnlich lange? */
function istFesthaenger(incident: SpielEinsatz, jetzt: number): boolean {
  const laufend = incident.status === 'alarmiert' || incident.status === 'in_bearbeitung' || incident.status === 'transport';
  return laufend && Number.isFinite(incident.createdAt) && jetzt - incident.createdAt > FESTHAENGER_MS;
}

/** Nur die echten Fehler (ohne Warnungen). */
export const nurFehler = (probleme: Problem[]): Problem[] => probleme.filter((problem) => problem.schwere === 'fehler');
