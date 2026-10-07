/**
 * Funkverkehr der Leitstelle: FMS-Status, Lagemeldungen als Funkspruch, Alarmdurchsagen und Sprechwünsche (Status 5).
 * Reine Funktionen – der Client vergleicht alten und neuen Zustand und hängt die Funksprüche an.
 */
import { formatEinsatzTitel, type EinsatzMeldung, type SpielEinsatz } from './daten.js';
import { istAusreichendBesetzt } from './fahrzeuge.js';
import { FMS_STATUS, type Vehicle } from './typen.js';

export const LEITSTELLE = 'Leitstelle';
export const FUNK_LIMIT = 300;

export type FunkArt = 'status' | 'lage' | 'alarm' | 'sprechwunsch' | 'sprechaufforderung';

export interface FunkSpruch {
  id: string;
  zeit: number;
  von: string;
  an: string;
  text: string;
  art: FunkArt;
  fahrzeugId?: string;
  einsatzId?: string;
  /** FMS-Status (bei Statusmeldungen) */
  status?: number;
  /** Sprechwunsch: noch nicht mit Sprechaufforderung beantwortet */
  offen?: boolean;
  /** Sprechwunsch: die zurückgehaltene Lagemeldung */
  meldungKey?: string;
  inhalt?: string;
}

export const FMS_TEXTE: Record<number, string> = {
  1: 'Frei über Funk',
  2: 'Einsatzbereit auf Wache',
  3: 'Einsatz übernommen',
  4: 'Am Einsatzort',
  5: 'Sprechwunsch',
  6: 'Nicht einsatzbereit',
  7: 'Patient aufgenommen',
  8: 'Am Transportziel',
};

/** Diese Lagemeldungen kommen als Sprechwunsch – man muss sie aktiv abfragen. */
const SPRECHWUNSCH_ARTEN: Array<EinsatzMeldung['art']> = ['nachforderung', 'entwarnung', 'eskalation'];

let zaehler = 0;
const funkId = (zeit: number) => `funk-${zeit}-${(zaehler += 1)}`;

export const funkname = (vehicle: Pick<Vehicle, 'callsign' | 'name'>) => vehicle.callsign ?? vehicle.name;

export const getMeldungKey = (einsatzId: string, meldung: Pick<EinsatzMeldung, 'zeit' | 'text'>) => `${einsatzId}|${meldung.zeit}|${meldung.text}`;

/** FMS-Status, den ein Fahrzeug nach außen zeigt (unbesetzt an der Wache = Status 6). */
export function getAngezeigterStatus(vehicle: Vehicle): number {
  const status = FMS_STATUS[vehicle.status ?? 'Einsatzbereit'];
  return status === 2 && !istAusreichendBesetzt(vehicle) ? 6 : status;
}

/** Statusmeldungen für alle Fahrzeuge, deren angezeigter Status sich geändert hat. */
export function erzeugeStatusFunk(vorher: Map<string, number>, vehicles: Vehicle[], zeit: number): FunkSpruch[] {
  return vehicles.flatMap((vehicle) => {
    const alt = vorher.get(vehicle.id);
    const neu = getAngezeigterStatus(vehicle);
    if (alt === undefined || alt === neu) return [];
    return [{
      id: funkId(zeit),
      zeit,
      von: funkname(vehicle),
      an: LEITSTELLE,
      text: `Status ${neu} – ${FMS_TEXTE[neu]}`,
      art: 'status' as const,
      fahrzeugId: vehicle.id,
      status: neu,
    }];
  });
}

export const getStatusStand = (vehicles: Vehicle[]) => new Map(vehicles.map((vehicle) => [vehicle.id, getAngezeigterStatus(vehicle)]));

/** Fahrzeug, von dem eine Lagemeldung stammt („RTW-1: …“ oder „RTW-1 vor Ort: …“). */
function findeQuelle(text: string, vehicles: Vehicle[]): Vehicle | undefined {
  return [...vehicles]
    .sort((a, b) => funkname(b).length - funkname(a).length)
    .find((vehicle) => text.startsWith(`${funkname(vehicle)}:`) || text.startsWith(`${funkname(vehicle)} vor Ort:`));
}

/** Text ohne vorangestellten Funknamen. */
const ohneQuelle = (text: string, vehicle?: Vehicle) => {
  if (!vehicle) return text;
  return text.replace(`${funkname(vehicle)} vor Ort: `, 'Vor Ort: ').replace(`${funkname(vehicle)}: `, '');
};

/**
 * Lagemeldung als Funkspruch. Nachforderung, Entwarnung und Eskalation von einem Fahrzeug kommen als Sprechwunsch
 * (Status 5) – der Inhalt wird erst nach der Sprechaufforderung bekannt.
 */
export function erzeugeMeldungsFunk(
  einsatz: Pick<SpielEinsatz, 'id' | 'stichwort' | 'meldebild' | 'alarmedVehicles'>,
  meldung: EinsatzMeldung,
  vehicles: Vehicle[],
): FunkSpruch {
  // Ohne Funknamen im Text (z. B. Eskalation während der Arbeit): meldet sich das erste Fahrzeug vor Ort
  const vorOrt = einsatz.alarmedVehicles
    .filter((a) => a.arrivalAt <= meldung.zeit && (a.freigegebenAt === undefined || a.freigegebenAt > meldung.zeit))
    .sort((a, b) => a.arrivalAt - b.arrivalAt)[0];
  const quelle = findeQuelle(meldung.text, vehicles) ?? vehicles.find((vehicle) => vehicle.id === vorOrt?.vehicleId);
  const inhalt = ohneQuelle(meldung.text, quelle);
  if (quelle && SPRECHWUNSCH_ARTEN.includes(meldung.art)) {
    return {
      id: funkId(meldung.zeit),
      zeit: meldung.zeit,
      von: funkname(quelle),
      an: LEITSTELLE,
      text: `Status 5 – ${FMS_TEXTE[5]} (${formatEinsatzTitel(einsatz)})`,
      art: 'sprechwunsch',
      fahrzeugId: quelle.id,
      einsatzId: einsatz.id,
      status: 5,
      offen: true,
      meldungKey: getMeldungKey(einsatz.id, meldung),
      inhalt,
    };
  }
  return {
    id: funkId(meldung.zeit),
    zeit: meldung.zeit,
    von: quelle ? funkname(quelle) : 'Einsatzstelle',
    an: LEITSTELLE,
    text: quelle ? `${funkname(quelle)} für ${LEITSTELLE}, kommen. ${inhalt}` : `${formatEinsatzTitel(einsatz)}: ${inhalt}`,
    art: 'lage',
    fahrzeugId: quelle?.id,
    einsatzId: einsatz.id,
  };
}

/** Alarmdurchsage im Leitstellenstil. */
export function erzeugeAlarmDurchsage(einsatz: Pick<SpielEinsatz, 'id' | 'stichwort' | 'meldebild' | 'address'>, fahrzeuge: Vehicle[], zeit: number): FunkSpruch {
  const namen = fahrzeuge.map(funkname).join(', ');
  return {
    id: funkId(zeit),
    zeit,
    von: LEITSTELLE,
    an: namen,
    text: `Alarm für ${namen}. ${einsatz.stichwort} – ${einsatz.meldebild}, ${einsatz.address}. Kommen.`,
    art: 'alarm',
    einsatzId: einsatz.id,
  };
}

/** Sprechaufforderung: Der Sprechwunsch wird beantwortet, das Fahrzeug gibt seine Meldung durch. */
export function quittiereSprechwunsch(funk: FunkSpruch[], sprechwunschId: string, zeit: number): FunkSpruch[] {
  const wunsch = funk.find((spruch) => spruch.id === sprechwunschId && spruch.offen);
  if (!wunsch) return funk;
  const antworten: FunkSpruch[] = [
    { id: funkId(zeit), zeit, von: LEITSTELLE, an: wunsch.von, text: `${wunsch.von}, Sprechaufforderung, kommen.`, art: 'sprechaufforderung', fahrzeugId: wunsch.fahrzeugId, einsatzId: wunsch.einsatzId },
    { id: funkId(zeit), zeit, von: wunsch.von, an: LEITSTELLE, text: wunsch.inhalt ?? '', art: 'lage', fahrzeugId: wunsch.fahrzeugId, einsatzId: wunsch.einsatzId },
  ];
  return [...antworten, ...funk.map((spruch) => (spruch.id === sprechwunschId ? { ...spruch, offen: false } : spruch))].slice(0, FUNK_LIMIT);
}

export const getOffeneSprechwuensche = (funk: FunkSpruch[]) => funk.filter((spruch) => spruch.art === 'sprechwunsch' && spruch.offen);

/** Lagemeldungen, deren Sprechwunsch noch nicht beantwortet ist (im Einsatz noch verborgen). */
export const getVerborgeneMeldungen = (funk: FunkSpruch[]) =>
  new Map(getOffeneSprechwuensche(funk).filter((s) => s.meldungKey).map((s) => [s.meldungKey!, s]));

/** Neue Funksprüche vorne anhängen (neueste zuerst), auf das Limit begrenzt. */
export const fuegeFunkHinzu = (funk: FunkSpruch[], neue: FunkSpruch[]) =>
  neue.length === 0 ? funk : [...[...neue].sort((a, b) => b.zeit - a.zeit), ...funk].slice(0, FUNK_LIMIT);
