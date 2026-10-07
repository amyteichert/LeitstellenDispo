/**
 * Zufriedenheit des Personals einer Wache (0–100).
 * Grundniveau aus Ausbauten (Aufenthaltsraum, Küche, Fitnessraum), Abzug bei Dauerstress (viele Alarmierungen kurz
 * hintereinander). Wirkt auf Ausrückzeit, Bewerber und – nur unter 40 % – auf Kündigungen.
 * Der Stress baut sich über Zeitstempel ab, funktioniert also auch, während das Spiel geschlossen ist.
 */
import type { Mitarbeiter } from './personal.js';
import type { MapLocation } from './typen.js';

const STUNDE = 60 * 60 * 1000;

export const ZUFRIEDENHEIT_CONFIG = {
  grundniveau: 60,
  /** Stress je Alarmierung eines Fahrzeugs der Wache */
  stressJeAlarm: 10,
  /** Stressabbau je Stunde */
  stressAbbauJeStunde: 20,
  maxStress: 100,
  /** Unterhalb dieses Stresses gibt es keinen Abzug („nur bei Dauerstress“) */
  stressSchwelle: 40,
  /** Abzug je Stresspunkt über der Schwelle */
  abzugJeStress: 0.8,
  /** Unterhalb dieser Zufriedenheit rückt das Personal langsamer aus … */
  ausrueckenAb: 60,
  /** … um so viele Sekunden je Prozentpunkt darunter */
  verzoegerungJeProzent: 1,
  /** Kündigungen nur unterhalb dieser Zufriedenheit */
  kuendigungUnter: 40,
  /** Kündigungswahrscheinlichkeit je Person und Stunde bei 0 % Zufriedenheit */
  maxKuendigungJeStunde: 0.05,
  /** Selbst ausgebildetes Personal kündigt seltener (Faktor) */
  treueFaktorAusgebildet: 0.3,
  /** Höchstens so viele Stunden werden beim Nachholen geprüft */
  maxNachholStunden: 48,
} as const;

export interface ZufriedenheitsAusbau {
  id: 'aufenthaltsraum' | 'kueche' | 'fitnessraum';
  name: string;
  text: string;
  bonusJeStufe: number;
  maxStufe: number;
  erstePreis: number;
  preisFaktor: number;
}

export const ZUFRIEDENHEITS_AUSBAUTEN: ZufriedenheitsAusbau[] = [
  { id: 'aufenthaltsraum', name: 'Aufenthaltsraum', text: 'Ein Ort zum Durchatmen zwischen den Einsätzen.', bonusJeStufe: 10, maxStufe: 2, erstePreis: 12000, preisFaktor: 1.6 },
  { id: 'kueche', name: 'Küche', text: 'Gemeinsam kochen und essen stärkt die Wachgemeinschaft.', bonusJeStufe: 8, maxStufe: 2, erstePreis: 18000, preisFaktor: 1.6 },
  { id: 'fitnessraum', name: 'Fitnessraum', text: 'Fit im Dienst – und ein Grund mehr, zu bleiben.', bonusJeStufe: 6, maxStufe: 2, erstePreis: 25000, preisFaktor: 1.6 },
];

const begrenze = (wert: number, min: number, max: number) => Math.min(max, Math.max(min, wert));

export const getAusbauStufe = (wache: Pick<MapLocation, 'ausbau'>, id: string) => wache.ausbau?.[id] ?? 0;

export function getZufriedenheitsAusbauPreis(wache: Pick<MapLocation, 'ausbau'>, ausbau: ZufriedenheitsAusbau): number | null {
  const stufe = getAusbauStufe(wache, ausbau.id);
  if (stufe >= ausbau.maxStufe) return null;
  return Math.round((ausbau.erstePreis * ausbau.preisFaktor ** stufe) / 500) * 500;
}

export const mitZufriedenheitsAusbau = (wache: MapLocation, id: ZufriedenheitsAusbau['id']): MapLocation => ({
  ...wache,
  ausbau: { ...wache.ausbau, [id]: getAusbauStufe(wache, id) + 1 },
});

/** Grundniveau ohne Stress: 60 % plus Ausbauten (höchstens 100 %). */
export const getGrundZufriedenheit = (wache: Pick<MapLocation, 'ausbau'>) =>
  Math.min(100, ZUFRIEDENHEITS_AUSBAUTEN.reduce<number>(
    (summe, ausbau) => summe + getAusbauStufe(wache, ausbau.id) * ausbau.bonusJeStufe,
    ZUFRIEDENHEIT_CONFIG.grundniveau,
  ));

/** Aktueller Stress (nach Abbau seit der letzten Änderung). */
export function getStress(wache: Pick<MapLocation, 'stress'>, jetzt: number): number {
  if (!wache.stress) return 0;
  const stunden = Math.max(0, jetzt - wache.stress.stand) / STUNDE;
  return Math.max(0, wache.stress.wert - stunden * ZUFRIEDENHEIT_CONFIG.stressAbbauJeStunde);
}

export function getZufriedenheit(wache: Pick<MapLocation, 'ausbau' | 'stress'>, jetzt: number): number {
  const ueberSchwelle = Math.max(0, getStress(wache, jetzt) - ZUFRIEDENHEIT_CONFIG.stressSchwelle);
  return Math.round(begrenze(getGrundZufriedenheit(wache) - ueberSchwelle * ZUFRIEDENHEIT_CONFIG.abzugJeStress, 0, 100));
}

/** Zusätzliche Sekunden bis zum Ausrücken bei niedriger Zufriedenheit. */
export const getAusrueckVerzoegerung = (wache: Pick<MapLocation, 'ausbau' | 'stress'>, jetzt: number) =>
  Math.max(0, ZUFRIEDENHEIT_CONFIG.ausrueckenAb - getZufriedenheit(wache, jetzt)) * ZUFRIEDENHEIT_CONFIG.verzoegerungJeProzent;

/** Faktor für die Qualifikations-Chance der Bewerber: 0,5 (0 %) bis 1,5 (100 %). */
export const getBewerberFaktor = (zufriedenheit: number) => 0.5 + zufriedenheit / 100;

/** Jede Alarmierung erhöht den Stress der Wache des Fahrzeugs. */
export function erhoeheStress(locations: MapLocation[], wacheIds: string[], jetzt: number): MapLocation[] {
  if (wacheIds.length === 0) return locations;
  return locations.map((wache) => {
    const anzahl = wacheIds.filter((id) => id === wache.id).length;
    if (anzahl === 0) return wache;
    const wert = Math.min(ZUFRIEDENHEIT_CONFIG.maxStress, getStress(wache, jetzt) + anzahl * ZUFRIEDENHEIT_CONFIG.stressJeAlarm);
    return { ...wache, stress: { wert, stand: jetzt } };
  });
}

/** Wahrscheinlichkeit, dass diese Person in einer Stunde kündigt. */
export function getKuendigungsChance(person: Pick<Mitarbeiter, 'ausgebildet'>, zufriedenheit: number): number {
  const { kuendigungUnter, maxKuendigungJeStunde, treueFaktorAusgebildet } = ZUFRIEDENHEIT_CONFIG;
  if (zufriedenheit >= kuendigungUnter) return 0;
  const chance = ((kuendigungUnter - zufriedenheit) / kuendigungUnter) * maxKuendigungJeStunde;
  return person.ausgebildet ? chance * treueFaktorAusgebildet : chance;
}

export interface Kuendigung {
  personId: string;
  name: string;
  wacheId: string;
  wacheName: string;
  zeit: number;
}

/**
 * Prüft stündlich (ab `kuendigungGeprueftAt` der Wache), ob jemand kündigt.
 * Nur Personal in Reserve oder auf einsatzbereiten Fahrzeugen; wer auf Lehrgang ist, kündigt nicht.
 */
export function pruefeKuendigungen(
  locations: MapLocation[],
  personal: Mitarbeiter[],
  istUnterwegs: (fahrzeugId: string) => boolean,
  jetzt: number,
  zufall: () => number = Math.random,
) {
  const kuendigungen: Kuendigung[] = [];
  let geaendert = false;

  const neueLocations = locations.map((wache) => {
    if (wache.type !== 'station') return wache;
    const letzte = wache.kuendigungGeprueftAt;
    if (letzte === undefined) {
      geaendert = true;
      return { ...wache, kuendigungGeprueftAt: jetzt };
    }
    const stunden = Math.floor((jetzt - letzte) / STUNDE);
    if (stunden < 1) return wache;
    geaendert = true;

    const zufriedenheit = getZufriedenheit(wache, jetzt);
    if (zufriedenheit < ZUFRIEDENHEIT_CONFIG.kuendigungUnter) {
      const pruefStunden = Math.min(stunden, ZUFRIEDENHEIT_CONFIG.maxNachholStunden);
      for (const person of personal) {
        if (person.wacheId !== wache.id || person.inAusbildungBis !== undefined) continue;
        if (person.fahrzeugId && istUnterwegs(person.fahrzeugId)) continue;
        const chance = getKuendigungsChance(person, zufriedenheit);
        for (let stunde = 0; stunde < pruefStunden; stunde += 1) {
          if (zufall() < chance) {
            kuendigungen.push({ personId: person.id, name: person.name, wacheId: wache.id, wacheName: wache.name, zeit: jetzt });
            break;
          }
        }
      }
    }
    return { ...wache, kuendigungGeprueftAt: letzte + stunden * STUNDE };
  });

  if (!geaendert) return { locations, personal, kuendigungen };
  const weg = new Set(kuendigungen.map((k) => k.personId));
  return {
    locations: neueLocations,
    personal: weg.size > 0 ? personal.filter((person) => !weg.has(person.id)) : personal,
    kuendigungen,
  };
}
