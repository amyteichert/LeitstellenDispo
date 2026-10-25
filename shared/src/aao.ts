/**
 * Alarm- und Ausrückeordnung (AAO): eigene Alarm-Knöpfe wie bei leitstellenspiel.de.
 * Ein Knopf wählt freie Fahrzeuge nach Typ/Kategorie (die schnellsten) und/oder alle freien Fahrzeuge ganzer Wachen.
 */
import { FAHRZEUG_TYPEN, getFahrzeugTyp, type FahrzeugKategorie } from './fahrzeuge.js';
import type { Vehicle } from './typen.js';

/** Schlüssel in `fahrzeuge` für „beliebiges Fahrzeug dieser Kategorie“ (z. B. irgendein Löschfahrzeug) */
export const AAO_KATEGORIE = 'kategorie:';

export interface AaoEintrag {
  id: string;
  name: string;
  /** Farbe des Knopfs (#rrggbb) */
  farbe: string;
  /** Reiter, unter dem der Knopf steht (z. B. „Feuerwehr“) */
  reiter: string;
  /** Anzahl je Fahrzeugtyp („HLF 20“) oder Kategorie („kategorie:Löschfahrzeug“) */
  fahrzeuge: Record<string, number>;
  /** Ganze Wachen: alle freien Fahrzeuge dieser Wachen */
  wachen: string[];
}

export const AAO_KATEGORIEN: FahrzeugKategorie[] = [...new Set(FAHRZEUG_TYPEN.map((typ) => typ.kategorie))];

/** Lesbarer Name eines Schlüssels aus `fahrzeuge` */
export const getAaoFahrzeugLabel = (schluessel: string) =>
  schluessel.startsWith(AAO_KATEGORIE) ? `${schluessel.slice(AAO_KATEGORIE.length)} (beliebig)` : schluessel;

/**
 * Startknöpfe, die es kurz gab – jetzt legt jeder seine AAO selbst an.
 * Unverändert gespeicherte Startknöpfe werden beim Laden entfernt.
 */
const FRUEHERE_STARTKNOEPFE: AaoEintrag[] = [
  {
    id: 'aao-loeschzug', name: 'Löschzug', farbe: '#dc2626', reiter: 'Feuerwehr', wachen: [],
    fahrzeuge: { [`${AAO_KATEGORIE}Einsatzleitwagen`]: 1, [`${AAO_KATEGORIE}Löschfahrzeug`]: 2, [`${AAO_KATEGORIE}Drehleiter`]: 1 },
  },
  { id: 'aao-lf', name: '1 Löschfahrzeug', farbe: '#ef4444', reiter: 'Feuerwehr', wachen: [], fahrzeuge: { [`${AAO_KATEGORIE}Löschfahrzeug`]: 1 } },
  { id: 'aao-rtw', name: 'RTW', farbe: '#ca8a04', reiter: 'Rettungsdienst', wachen: [], fahrzeuge: { RTW: 1 } },
  { id: 'aao-rtw-nef', name: 'RTW + NEF', farbe: '#d97706', reiter: 'Rettungsdienst', wachen: [], fahrzeuge: { RTW: 1, NEF: 1 } },
];
const istFruehererStartknopf = (eintrag: AaoEintrag) =>
  FRUEHERE_STARTKNOEPFE.some((start) => JSON.stringify(start) === JSON.stringify(eintrag));

const passtZu = (schluessel: string, vehicle: Vehicle) =>
  schluessel.startsWith(AAO_KATEGORIE)
    ? getFahrzeugTyp(vehicle.type)?.kategorie === schluessel.slice(AAO_KATEGORIE.length)
    : vehicle.type === schluessel;

/**
 * Fahrzeuge für einen AAO-Knopf: erst ganze Wachen, dann feste Typen, zuletzt beliebige Kategorien – je die schnellsten.
 * `schonGewaehlt` wird übersprungen, ein zweiter Klick wählt also weitere Fahrzeuge dazu (wie im Vorbild).
 */
export function waehleAaoFahrzeuge(
  eintrag: AaoEintrag,
  verfuegbar: Array<{ vehicle: Vehicle; anfahrtSekunden: number }>,
  schonGewaehlt: string[] = [],
): { fahrzeugIds: string[]; fehlt: string[] } {
  const frei = [...verfuegbar]
    .sort((a, b) => a.anfahrtSekunden - b.anfahrtSekunden)
    .filter(({ vehicle }) => !schonGewaehlt.includes(vehicle.id));
  const fahrzeugIds: string[] = [];
  const fehlt: string[] = [];

  for (const wacheId of eintrag.wachen) {
    const ids = frei
      .filter(({ vehicle }) => vehicle.stationId === wacheId && !fahrzeugIds.includes(vehicle.id))
      .map(({ vehicle }) => vehicle.id);
    if (ids.length === 0) fehlt.push('Wache ohne freies Fahrzeug');
    fahrzeugIds.push(...ids);
  }

  const schluessel = Object.entries(eintrag.fahrzeuge)
    .filter(([, anzahl]) => anzahl > 0)
    .sort(([a], [b]) => Number(a.startsWith(AAO_KATEGORIE)) - Number(b.startsWith(AAO_KATEGORIE)));
  for (const [key, anzahl] of schluessel) {
    const ids = frei
      .filter(({ vehicle }) => !fahrzeugIds.includes(vehicle.id) && passtZu(key, vehicle))
      .slice(0, anzahl)
      .map(({ vehicle }) => vehicle.id);
    if (ids.length < anzahl) fehlt.push(`${anzahl - ids.length}× ${getAaoFahrzeugLabel(key)}`);
    fahrzeugIds.push(...ids);
  }
  return { fahrzeugIds, fehlt };
}

/** Geladene AAO prüfen – ohne AAO (neues oder altes Spiel) gibt es noch keine Knöpfe */
export const ladeAao = (roh: unknown): AaoEintrag[] =>
  Array.isArray(roh)
    ? roh.filter((e): e is AaoEintrag => Boolean(e) && typeof e.id === 'string' && typeof e.name === 'string'
      && typeof e.fahrzeuge === 'object' && e.fahrzeuge !== null && Array.isArray(e.wachen) && !istFruehererStartknopf(e))
    : [];
