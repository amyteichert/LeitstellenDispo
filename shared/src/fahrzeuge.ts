/**
 * Zentraler Fahrzeugkatalog: Typen, Fähigkeiten, Besatzung, Geschwindigkeit und Preis.
 * Alle anderen Stellen (Kaufen, Alarmierung, Einsatzbedarf, Fahrzeiten) lesen nur von hier.
 */
import { GAME_CONFIG } from './konfig.js';
import type { EinsatzOrganisation, Vehicle, WachenArt } from './typen.js';

/** Grobe Fahrzeugklasse – so denkt der Disponent („2 LF und eine DLK“). */
export type FahrzeugKategorie = 'RTW' | 'NEF' | 'KTW' | 'Löschfahrzeug' | 'Drehleiter' | 'Rüstwagen' | 'Einsatzleitwagen';

/** Was ein Fahrzeug kann. Bewusst wenige – nur was die Spiellogik aktuell nutzt. */
export type Faehigkeit =
  | 'brandbekaempfung'
  | 'technische_hilfe'
  | 'hoehenrettung'
  | 'patientenversorgung'
  | 'patiententransport'
  | 'notarzt'
  | 'schwere_technik'
  | 'rettungsgeraet'
  | 'einsatzleitung';

export const FAEHIGKEIT_LABELS: Record<Faehigkeit, string> = {
  brandbekaempfung: 'Brandbekämpfung',
  technische_hilfe: 'Technische Hilfeleistung',
  hoehenrettung: 'Menschenrettung über Drehleiter',
  patientenversorgung: 'Patientenversorgung',
  patiententransport: 'Patiententransport',
  notarzt: 'Notarztversorgung',
  schwere_technik: 'Schwere technische Rettung',
  rettungsgeraet: 'Hydraulisches Rettungsgerät',
  einsatzleitung: 'Einsatzleitung',
};

/** Qualifikationen des Personals – nur die, die ein Fahrzeug zwingend braucht. */
export type Qualifikation =
  | 'rettungssanitaeter'
  | 'notfallsanitaeter'
  | 'notarzt'
  | 'maschinist_dlk'
  | 'gruppenfuehrer'
  | 'zugfuehrer'
  | 'technische_hilfe';

export const QUALIFIKATION_LABELS: Record<Qualifikation, string> = {
  rettungssanitaeter: 'Rettungssanitäter',
  notfallsanitaeter: 'Notfallsanitäter',
  notarzt: 'Notarzt',
  maschinist_dlk: 'Maschinist Drehleiter',
  gruppenfuehrer: 'Gruppenführer',
  zugfuehrer: 'Zugführer',
  technische_hilfe: 'Technische Hilfeleistung',
};

/** Höhere Qualifikationen schließen niedrigere ein (z. B. darf ein Notfallsanitäter auch KTW fahren). */
const QUALIFIKATION_UMFASST: Partial<Record<Qualifikation, Qualifikation[]>> = {
  notfallsanitaeter: ['rettungssanitaeter'],
  notarzt: ['rettungssanitaeter'],
  zugfuehrer: ['gruppenfuehrer'],
};

/** Hat jemand mit diesen Qualifikationen die gesuchte – direkt oder über eine höhere? */
export const besitztQualifikation = (qualifikationen: Qualifikation[], gesucht: Qualifikation) =>
  qualifikationen.some((q) => q === gesucht || (QUALIFIKATION_UMFASST[q] ?? []).includes(gesucht));

export interface FahrzeugTyp {
  /** Typbezeichnung, z. B. "RTW" oder "HLF 20" */
  typ: string;
  /** Ausgeschriebener Name */
  bezeichnung: string;
  kategorie: FahrzeugKategorie;
  organisation: EinsatzOrganisation;
  wachenArt: WachenArt;
  preis: number;
  /** Durchschnittliche Geschwindigkeit mit Sonderrechten (Luftlinie) */
  geschwindigkeitKmh: number;
  /** Sollbesatzung (Personen) */
  besatzung: number;
  faehigkeiten: Faehigkeit[];
  /** Jede dieser Qualifikationen muss mindestens eine Person der Besatzung haben */
  pflichtQualifikationen?: Qualifikation[];
  /** Sonderfahrzeuge, die allein kaum Einsätze schaffen, gibt es nicht als Startfahrzeug */
  keinStartfahrzeug?: boolean;
  /** Erst kaufbar, wenn der Spieler ein eigenes Krankenhaus hat */
  brauchtEigenesKrankenhaus?: boolean;
}

/** Alle Fahrzeugtypen, die im Spiel gekauft bzw. als Startfahrzeug gewählt werden können. */
export const FAHRZEUG_TYPEN: FahrzeugTyp[] = [
  {
    typ: 'RTW', bezeichnung: 'Rettungswagen', kategorie: 'RTW', organisation: 'Rettungsdienst', wachenArt: 'Rettungswache',
    preis: 4000, geschwindigkeitKmh: 60, besatzung: 2, faehigkeiten: ['patientenversorgung', 'patiententransport'], pflichtQualifikationen: ['notfallsanitaeter'],
  },
  {
    typ: 'NEF', bezeichnung: 'Notarzteinsatzfahrzeug', kategorie: 'NEF', organisation: 'Rettungsdienst', wachenArt: 'Rettungswache',
    preis: 3500, geschwindigkeitKmh: 70, besatzung: 2, faehigkeiten: ['notarzt', 'patientenversorgung'], pflichtQualifikationen: ['notarzt'],
  },
  {
    typ: 'KTW', bezeichnung: 'Krankentransportwagen', kategorie: 'KTW', organisation: 'Rettungsdienst', wachenArt: 'Rettungswache',
    preis: 2500, geschwindigkeitKmh: 55, besatzung: 2, faehigkeiten: ['patiententransport'], pflichtQualifikationen: ['rettungssanitaeter'],
    keinStartfahrzeug: true, brauchtEigenesKrankenhaus: true,
  },
  {
    typ: 'LF 10', bezeichnung: 'Löschgruppenfahrzeug 10', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 5000, geschwindigkeitKmh: 52, besatzung: 9, faehigkeiten: ['brandbekaempfung', 'technische_hilfe'], pflichtQualifikationen: ['gruppenfuehrer'],
  },
  {
    typ: 'LF 20', bezeichnung: 'Löschgruppenfahrzeug 20', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 6500, geschwindigkeitKmh: 50, besatzung: 9, faehigkeiten: ['brandbekaempfung', 'technische_hilfe'], pflichtQualifikationen: ['gruppenfuehrer'],
  },
  {
    typ: 'HLF 20', bezeichnung: 'Hilfeleistungslöschgruppenfahrzeug 20', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 8000, geschwindigkeitKmh: 50, besatzung: 9, faehigkeiten: ['brandbekaempfung', 'technische_hilfe', 'rettungsgeraet'],
    pflichtQualifikationen: ['gruppenfuehrer', 'technische_hilfe'],
  },
  {
    typ: 'TLF 2000', bezeichnung: 'Tanklöschfahrzeug 2000', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 4500, geschwindigkeitKmh: 50, besatzung: 3, faehigkeiten: ['brandbekaempfung'],
  },
  {
    typ: 'TLF 3000', bezeichnung: 'Tanklöschfahrzeug 3000', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 5500, geschwindigkeitKmh: 48, besatzung: 3, faehigkeiten: ['brandbekaempfung'],
  },
  {
    typ: 'TLF 4000', bezeichnung: 'Tanklöschfahrzeug 4000', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 7000, geschwindigkeitKmh: 46, besatzung: 3, faehigkeiten: ['brandbekaempfung'],
  },
  {
    typ: 'DLK 23/12', bezeichnung: 'Drehleiter mit Korb', kategorie: 'Drehleiter', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 9000, geschwindigkeitKmh: 48, besatzung: 3, faehigkeiten: ['hoehenrettung', 'brandbekaempfung'], pflichtQualifikationen: ['maschinist_dlk'],
  },
  {
    typ: 'RW', bezeichnung: 'Rüstwagen', kategorie: 'Rüstwagen', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 7500, geschwindigkeitKmh: 50, besatzung: 3, faehigkeiten: ['technische_hilfe', 'schwere_technik', 'rettungsgeraet'],
    pflichtQualifikationen: ['technische_hilfe'], keinStartfahrzeug: true,
  },
  {
    typ: 'ELW 1', bezeichnung: 'Einsatzleitwagen 1', kategorie: 'Einsatzleitwagen', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 6000, geschwindigkeitKmh: 60, besatzung: 3, faehigkeiten: ['einsatzleitung'], pflichtQualifikationen: ['zugfuehrer'], keinStartfahrzeug: true,
  },
];

export function getFahrzeugTyp(typ?: string): FahrzeugTyp | undefined {
  return FAHRZEUG_TYPEN.find((eintrag) => eintrag.typ === typ);
}

export function getFahrzeugKategorie(typ?: string): FahrzeugKategorie | null {
  return getFahrzeugTyp(typ)?.kategorie ?? null;
}

export function getFahrzeugTypenFuerWache(wachenArt: WachenArt): FahrzeugTyp[] {
  return FAHRZEUG_TYPEN.filter((eintrag) => eintrag.wachenArt === wachenArt);
}

/** Kurzform des Typs für Funkrufnamen: „LF 20“ → „LF20“, „DLK 23/12“ → „DLK“ */
export const getFunkKurzname = (typ: string) => typ.replace(/\s+\d+\/\d+$/, '').replace(/\s+/g, '');

export const FUNKRUFNAME_MAX_LAENGE = 24;

/**
 * Nächster freier Funkrufname an einer Wache: „RTW-1“, „RTW-2“ … – gezählt je Wache und Typ.
 * Lücken (verkaufte Fahrzeuge) werden wieder aufgefüllt, doppelte Namen gibt es nicht.
 */
export function getNaechsterFunkrufname(
  typ: string,
  stationId: string | undefined,
  vehicles: Array<Pick<Vehicle, 'callsign' | 'stationId'>>,
): string {
  const kurz = getFunkKurzname(typ);
  const vergeben = new Set(vehicles.filter((vehicle) => vehicle.stationId === stationId).map((vehicle) => vehicle.callsign));
  let nummer = 1;
  while (vergeben.has(`${kurz}-${nummer}`)) nummer += 1;
  return `${kurz}-${nummer}`;
}

/** Pflicht-Qualifikationen eines Typs, die in dieser Besatzung noch niemand hat */
export function getFehlendeQualifikationen(
  typ: string | undefined,
  besatzung: Array<{ qualifikationen: Qualifikation[] }>,
): Qualifikation[] {
  return (getFahrzeugTyp(typ)?.pflichtQualifikationen ?? [])
    .filter((pflicht) => !besatzung.some((person) => besitztQualifikation(person.qualifikationen, pflicht)));
}

/** Fahrzeugtypen, die beim Bau einer Wache als Startfahrzeug wählbar sind */
export function getStartfahrzeugTypen(wachenArt: WachenArt): FahrzeugTyp[] {
  return getFahrzeugTypenFuerWache(wachenArt).filter((eintrag) => !eintrag.keinStartfahrzeug);
}

export function hatFaehigkeit(typ: string | undefined, faehigkeit: Faehigkeit): boolean {
  return getFahrzeugTyp(typ)?.faehigkeiten.includes(faehigkeit) ?? false;
}

/** Geschwindigkeit eines Fahrzeugtyps (unbekannte Typen fahren mit dem Durchschnitt). */
export function getFahrzeugGeschwindigkeit(typ?: string): number {
  return getFahrzeugTyp(typ)?.geschwindigkeitKmh ?? GAME_CONFIG.averageSpeedKmh;
}

/** Ist das Fahrzeug ausreichend besetzt? Ältere Spielstände ohne Angabe gelten als voll besetzt. */
export function istAusreichendBesetzt(vehicle: Pick<Vehicle, 'type' | 'besatzung' | 'fehlendeQualifikation'>): boolean {
  if (vehicle.fehlendeQualifikation) return false;
  if (vehicle.besatzung === undefined) return true;
  return vehicle.besatzung >= (getFahrzeugTyp(vehicle.type)?.besatzung ?? 1);
}

// ---------------------------------------------------------------------------
// Fahrzeugbedarf eines Einsatzes
// ---------------------------------------------------------------------------

/**
 * Wonach ein Einsatz fragt: eine Fahrzeugklasse oder eine Fähigkeit.
 * „Technische Hilfe“ können z. B. LF und HLF leisten, ein TLF aber nicht.
 */
export type BedarfsKlasse = FahrzeugKategorie | 'Technische Hilfe' | 'Rettungsgerät' | 'Krankentransport';

interface BedarfsKlassenInfo {
  /** Anzeige, z. B. „LF/HLF (Technische Hilfe)“ */
  label: string;
  kategorien?: FahrzeugKategorie[];
  faehigkeit?: Faehigkeit;
}

export const BEDARFS_KLASSEN: Record<BedarfsKlasse, BedarfsKlassenInfo> = {
  RTW: { label: 'RTW', kategorien: ['RTW'] },
  NEF: { label: 'NEF', kategorien: ['NEF'] },
  Löschfahrzeug: { label: 'Löschfahrzeug', kategorien: ['Löschfahrzeug'] },
  Drehleiter: { label: 'Drehleiter', kategorien: ['Drehleiter'] },
  KTW: { label: 'KTW', kategorien: ['KTW'] },
  Rüstwagen: { label: 'Rüstwagen', kategorien: ['Rüstwagen'] },
  Einsatzleitwagen: { label: 'ELW', kategorien: ['Einsatzleitwagen'] },
  'Technische Hilfe': { label: 'LF/HLF/RW (Techn. Hilfe)', faehigkeit: 'technische_hilfe' },
  /** Schere und Spreizer für eingeklemmte Personen: nur HLF und Rüstwagen */
  Rettungsgerät: { label: 'HLF/RW (Rettungsgerät)', faehigkeit: 'rettungsgeraet' },
  /** Krankentransport kann ein KTW oder ein RTW übernehmen */
  Krankentransport: { label: 'KTW/RTW (Krankentransport)', faehigkeit: 'patiententransport' },
};

export interface FahrzeugBedarf {
  id: string;
  category: BedarfsKlasse;
  amount: number;
}

export const getBedarfsLabel = (klasse: BedarfsKlasse) => BEDARFS_KLASSEN[klasse]?.label ?? klasse;

/** Kann ein Fahrzeug dieses Typs einen Platz dieser Bedarfsklasse füllen? */
export function fahrzeugErfuelltBedarf(typ: string | undefined, klasse: BedarfsKlasse): boolean {
  const fahrzeugTyp = getFahrzeugTyp(typ);
  const info = BEDARFS_KLASSEN[klasse];
  if (!fahrzeugTyp || !info) return false;
  if (info.kategorien && !info.kategorien.includes(fahrzeugTyp.kategorie)) return false;
  if (info.faehigkeit && !fahrzeugTyp.faehigkeiten.includes(info.faehigkeit)) return false;
  return true;
}

/**
 * Ordnet Fahrzeuge den Bedarfsplätzen zu – jedes Fahrzeug füllt höchstens einen Platz.
 * (Bipartites Matching: ein LF wird z. B. nicht gleichzeitig als Löschfahrzeug und als TH-Fahrzeug gezählt,
 * wird aber dorthin verschoben, wo es gebraucht wird.)
 * Ergebnis: je Bedarf (gleiche Reihenfolge) die IDs der zugeordneten Fahrzeuge.
 */
export function ordneFahrzeugeBedarfZu(
  bedarf: FahrzeugBedarf[],
  fahrzeuge: Array<{ id: string; type?: string }>,
): string[][] {
  const plaetze = bedarf.flatMap((eintrag, index) => Array.from({ length: eintrag.amount }, () => index));
  const platzVonFahrzeug = new Map<string, number>();

  const versuche = (platz: number, besucht: Set<string>): boolean => {
    for (const fahrzeug of fahrzeuge) {
      if (besucht.has(fahrzeug.id) || !fahrzeugErfuelltBedarf(fahrzeug.type, bedarf[plaetze[platz]].category)) continue;
      besucht.add(fahrzeug.id);
      const belegt = platzVonFahrzeug.get(fahrzeug.id);
      if (belegt === undefined || versuche(belegt, besucht)) {
        platzVonFahrzeug.set(fahrzeug.id, platz);
        return true;
      }
    }
    return false;
  };

  plaetze.forEach((_, platz) => versuche(platz, new Set()));

  const ergebnis: string[][] = bedarf.map(() => []);
  for (const [fahrzeugId, platz] of platzVonFahrzeug) ergebnis[plaetze[platz]].push(fahrzeugId);
  return ergebnis;
}

/** Wie viele Plätze je Bedarf fehlen noch, wenn diese Fahrzeuge da sind? */
export function getFehlendenBedarf(
  bedarf: FahrzeugBedarf[],
  fahrzeuge: Array<{ id: string; type?: string }>,
): Array<{ category: BedarfsKlasse; anzahl: number }> {
  const zuordnung = ordneFahrzeugeBedarfZu(bedarf, fahrzeuge);
  return bedarf
    .map((eintrag, index) => ({ category: eintrag.category, anzahl: eintrag.amount - zuordnung[index].length }))
    .filter((eintrag) => eintrag.anzahl > 0);
}

export const istBedarfGedeckt = (bedarf: FahrzeugBedarf[], fahrzeuge: Array<{ id: string; type?: string }>) =>
  getFehlendenBedarf(bedarf, fahrzeuge).length === 0;

/** z. B. „1× NEF, 2× Löschfahrzeug“ */
export const formatBedarfsListe = (eintraege: Array<{ category: BedarfsKlasse; anzahl: number }>) =>
  eintraege.map((eintrag) => `${eintrag.anzahl}× ${getBedarfsLabel(eintrag.category)}`).join(', ');

/** Bedarf zusammenführen (gleiche Klassen werden addiert) – z. B. bei einer Nachforderung. */
export function ergaenzeBedarf(bedarf: FahrzeugBedarf[], zusatz: FahrzeugBedarf[]): FahrzeugBedarf[] {
  const ergebnis = bedarf.map((eintrag) => ({ ...eintrag }));
  for (const neu of zusatz) {
    const vorhanden = ergebnis.find((eintrag) => eintrag.category === neu.category);
    if (vorhanden) vorhanden.amount += neu.amount;
    else ergebnis.push({ ...neu });
  }
  return ergebnis;
}
