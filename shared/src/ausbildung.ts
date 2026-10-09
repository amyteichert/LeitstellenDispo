/**
 * Ausbildung an der Wache: Ausbildungsbereich mit Räumen, ein Lehrgang pro Raum.
 * Teilnehmer fehlen während des Lehrgangs auf ihrem Fahrzeug. Alles läuft über Zeitstempel –
 * also auch weiter, während das Spiel geschlossen ist.
 */
import { besitztQualifikation, type Qualifikation } from './fahrzeuge.js';
import type { Mitarbeiter } from './personal.js';
import type { AusbildungsRaum, MapLocation, WachenArt } from './typen.js';

const STUNDE = 60 * 60 * 1000;
const TAG = 24 * STUNDE;

export interface Lehrgang {
  qualifikation: Qualifikation;
  dauerMs: number;
  /** Kosten je Teilnehmer */
  kosten: number;
  wachenArt: WachenArt;
  /** Diese Qualifikation muss der Teilnehmer schon haben */
  voraussetzung?: Qualifikation;
}

export const LEHRGAENGE: Lehrgang[] = [
  { qualifikation: 'rettungssanitaeter', dauerMs: 1 * TAG, kosten: 1000, wachenArt: 'Rettungswache' },
  { qualifikation: 'notfallsanitaeter', dauerMs: 3 * TAG, kosten: 2000, wachenArt: 'Rettungswache' },
  { qualifikation: 'notarzt', dauerMs: 5 * TAG, kosten: 6000, wachenArt: 'Rettungswache', voraussetzung: 'notfallsanitaeter' },
  { qualifikation: 'gruppenfuehrer', dauerMs: 2 * TAG, kosten: 2000, wachenArt: 'Feuerwache' },
  { qualifikation: 'maschinist_dlk', dauerMs: 1 * TAG, kosten: 1500, wachenArt: 'Feuerwache' },
  { qualifikation: 'technische_hilfe', dauerMs: 1 * TAG, kosten: 1500, wachenArt: 'Feuerwache' },
  { qualifikation: 'zugfuehrer', dauerMs: 3 * TAG, kosten: 3500, wachenArt: 'Feuerwache', voraussetzung: 'gruppenfuehrer' },
];

export const AUSBILDUNG_CONFIG = {
  /** Ausbildungsbereich inkl. erstem Raum */
  bereichPreis: 40000,
  raumPreis: 50000,
  raumPreisFaktor: 1.6,
  maxRaeume: 4,
  plaetzeJeRaum: 4,
  plaetzeJeUpgrade: 2,
  upgradePreis: 15000,
  upgradePreisFaktor: 1.6,
  maxUpgradesJeRaum: 3,
} as const;

const rundePreis = (preis: number) => Math.round(preis / 500) * 500;

export const getLehrgang = (qualifikation: Qualifikation) => LEHRGAENGE.find((l) => l.qualifikation === qualifikation);

export const getLehrgaengeFuerWache = (wache: Pick<MapLocation, 'stationKind'>) =>
  LEHRGAENGE.filter((l) => l.wachenArt === (wache.stationKind ?? 'Rettungswache'));

export const getAusbildungsRaeume = (wache: Pick<MapLocation, 'ausbildungsRaeume'>) => wache.ausbildungsRaeume ?? [];

export const hatAusbildungsbereich = (wache: Pick<MapLocation, 'ausbildungsRaeume'>) => getAusbildungsRaeume(wache).length > 0;

export const getRaumPlaetze = (raum: AusbildungsRaum) =>
  AUSBILDUNG_CONFIG.plaetzeJeRaum + raum.upgrades * AUSBILDUNG_CONFIG.plaetzeJeUpgrade;

/** Preis für den nächsten Raum (der erste kommt mit dem Ausbildungsbereich) – null, wenn kein weiterer möglich. */
export function getNaechsterRaumPreis(wache: Pick<MapLocation, 'ausbildungsRaeume'>): number | null {
  const anzahl = getAusbildungsRaeume(wache).length;
  if (anzahl === 0) return AUSBILDUNG_CONFIG.bereichPreis;
  if (anzahl >= AUSBILDUNG_CONFIG.maxRaeume) return null;
  return rundePreis(AUSBILDUNG_CONFIG.raumPreis * AUSBILDUNG_CONFIG.raumPreisFaktor ** (anzahl - 1));
}

export function getRaumUpgradePreis(raum: AusbildungsRaum): number | null {
  if (raum.upgrades >= AUSBILDUNG_CONFIG.maxUpgradesJeRaum) return null;
  return rundePreis(AUSBILDUNG_CONFIG.upgradePreis * AUSBILDUNG_CONFIG.upgradePreisFaktor ** raum.upgrades);
}

export const mitNeuemRaum = (wache: MapLocation): MapLocation => {
  const raeume = getAusbildungsRaeume(wache);
  return { ...wache, ausbildungsRaeume: [...raeume, { id: `raum-${raeume.length + 1}`, upgrades: 0 }] };
};

export const mitRaumUpgrade = (wache: MapLocation, raumId: string): MapLocation => ({
  ...wache,
  ausbildungsRaeume: getAusbildungsRaeume(wache).map((raum) => (raum.id === raumId ? { ...raum, upgrades: raum.upgrades + 1 } : raum)),
});

export const istInAusbildung = (person: Pick<Mitarbeiter, 'inAusbildungBis'>) => person.inAusbildungBis !== undefined;

/** Kann diese Person den Lehrgang besuchen? Gibt den Grund zurück, wenn nicht. */
export function pruefeTeilnehmer(person: Mitarbeiter, lehrgang: Lehrgang): string | null {
  if (istInAusbildung(person)) return `${person.name} ist bereits in Ausbildung.`;
  if (besitztQualifikation(person.qualifikationen, lehrgang.qualifikation)) return `${person.name} hat diese Qualifikation schon.`;
  if (lehrgang.voraussetzung && !besitztQualifikation(person.qualifikationen, lehrgang.voraussetzung)) {
    return `${person.name} erfüllt die Voraussetzung nicht.`;
  }
  return null;
}

export interface LehrgangStart {
  wache: MapLocation;
  raumId: string;
  qualifikation: Qualifikation;
  teilnehmerIds: string[];
  personal: Mitarbeiter[];
  jetzt: number;
}

export type LehrgangStartErgebnis =
  | { fehler: string }
  | { wache: MapLocation; personal: Mitarbeiter[]; kosten: number };

/**
 * Startet einen Lehrgang in einem freien Raum. Die Teilnehmer verlassen ihr Fahrzeug.
 * (Ob ihr Fahrzeug gerade an der Wache steht, prüft der Aufrufer – er kennt die Fahrzeuge.)
 */
export function starteLehrgang({ wache, raumId, qualifikation, teilnehmerIds, personal, jetzt }: LehrgangStart): LehrgangStartErgebnis {
  const lehrgang = getLehrgang(qualifikation);
  if (!lehrgang || lehrgang.wachenArt !== (wache.stationKind ?? 'Rettungswache')) return { fehler: 'Dieser Lehrgang ist an dieser Wache nicht möglich.' };
  const raum = getAusbildungsRaeume(wache).find((r) => r.id === raumId);
  if (!raum) return { fehler: 'Raum nicht gefunden.' };
  if (raum.lehrgang) return { fehler: 'In diesem Raum läuft bereits ein Lehrgang.' };
  const ids = [...new Set(teilnehmerIds)];
  if (ids.length === 0) return { fehler: 'Bitte mindestens einen Teilnehmer wählen.' };
  if (ids.length > getRaumPlaetze(raum)) return { fehler: `Der Raum hat nur ${getRaumPlaetze(raum)} Plätze.` };

  for (const id of ids) {
    const person = personal.find((p) => p.id === id);
    if (!person || person.wacheId !== wache.id) return { fehler: 'Teilnehmer gehört nicht zu dieser Wache.' };
    const grund = pruefeTeilnehmer(person, lehrgang);
    if (grund) return { fehler: grund };
  }

  const endeAt = jetzt + lehrgang.dauerMs;
  return {
    kosten: lehrgang.kosten * ids.length,
    wache: {
      ...wache,
      ausbildungsRaeume: getAusbildungsRaeume(wache).map((r) => (
        r.id === raumId ? { ...r, lehrgang: { qualifikation, teilnehmerIds: ids, startAt: jetzt, endeAt } } : r
      )),
    },
    personal: personal.map((p) => (ids.includes(p.id) ? { ...p, fahrzeugId: undefined, inAusbildungBis: endeAt } : p)),
  };
}

export interface AbgeschlossenerLehrgang {
  wacheId: string;
  wacheName: string;
  qualifikation: Qualifikation;
  namen: string[];
}

/** Beendet alle fälligen Lehrgänge: Teilnehmer bekommen die Qualifikation und kommen in die Reserve. */
export function schliesseLehrgaengeAb(locations: MapLocation[], personal: Mitarbeiter[], jetzt: number) {
  const abgeschlossen: AbgeschlossenerLehrgang[] = [];
  const fertig = new Map<string, Qualifikation>();

  const neueLocations = locations.map((wache) => {
    const raeume = getAusbildungsRaeume(wache);
    if (!raeume.some((r) => r.lehrgang && r.lehrgang.endeAt <= jetzt)) return wache;
    return {
      ...wache,
      ausbildungsRaeume: raeume.map((raum) => {
        if (!raum.lehrgang || raum.lehrgang.endeAt > jetzt) return raum;
        const { qualifikation, teilnehmerIds } = raum.lehrgang;
        teilnehmerIds.forEach((id) => fertig.set(id, qualifikation));
        abgeschlossen.push({
          wacheId: wache.id,
          wacheName: wache.name,
          qualifikation,
          namen: teilnehmerIds.map((id) => personal.find((p) => p.id === id)?.name).filter((n): n is string => Boolean(n)),
        });
        return { id: raum.id, upgrades: raum.upgrades };
      }),
    };
  });

  if (abgeschlossen.length === 0) return { locations, personal, abgeschlossen };
  return {
    locations: neueLocations,
    personal: personal.map((p) => {
      const qualifikation = fertig.get(p.id);
      if (!qualifikation) return p;
      const { inAusbildungBis: _ende, ...rest } = p;
      return { ...rest, ausgebildet: true, qualifikationen: [...new Set([...p.qualifikationen, qualifikation])] };
    }),
    abgeschlossen,
  };
}
