import { GAME_CONFIG } from './konfig.js';

export const APP_NAME = 'LeitstellenDispo';
export const APP_SUBTITLE = 'Deine Leitstelle. Deine Einsätze. Deine Entscheidungen.';
export const APP_VERSION = '0.1.0-alpha';

export type UserRole = 'player' | 'admin' | 'co_owner' | 'owner';

export interface AppInfo {
  name: string;
  subtitle: string;
  version: string;
}

export interface GameLocation {
  id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface Organization {
  id: string;
  name: string;
  type?: string;
  description?: string;
}

export interface Station {
  id: string;
  name: string;
  organizationId?: string;
  location?: GameLocation;
  description?: string;
}

export type EinsatzStatus = 'offen' | 'alarmiert' | 'in_bearbeitung' | 'abgeschlossen';

export const EINSATZ_STATUS_LABELS: Record<EinsatzStatus, string> = {
  offen: 'Offen',
  alarmiert: 'Fahrzeuge alarmiert',
  in_bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Abgeschlossen',
};

export type EinsatzOrganisation = 'Rettungsdienst' | 'Feuerwehr';

export type FahrzeugKategorie = 'RTW' | 'NEF' | 'Löschfahrzeug' | 'Drehleiter';

export interface FahrzeugTyp {
  /** Typbezeichnung, z. B. "RTW" oder "HLF 20" */
  typ: string;
  kategorie: FahrzeugKategorie;
  wachenArt: WachenArt;
  preis: number;
}

/** Startguthaben für ein neues Spiel */
export const START_GUTHABEN = 20000;

/** Baukosten je Wachenart */
export const WACHEN_PREISE: Record<WachenArt, number> = {
  Rettungswache: 8000,
  Feuerwache: 15000,
};

/** Alle Fahrzeugtypen, die im Spiel gekauft bzw. als Startfahrzeug gewählt werden können. */
export const FAHRZEUG_TYPEN: FahrzeugTyp[] = [
  { typ: 'RTW', kategorie: 'RTW', wachenArt: 'Rettungswache', preis: 4000 },
  { typ: 'NEF', kategorie: 'NEF', wachenArt: 'Rettungswache', preis: 3500 },
  { typ: 'LF 10', kategorie: 'Löschfahrzeug', wachenArt: 'Feuerwache', preis: 5000 },
  { typ: 'LF 20', kategorie: 'Löschfahrzeug', wachenArt: 'Feuerwache', preis: 6500 },
  { typ: 'HLF 20', kategorie: 'Löschfahrzeug', wachenArt: 'Feuerwache', preis: 8000 },
  { typ: 'TLF 2000', kategorie: 'Löschfahrzeug', wachenArt: 'Feuerwache', preis: 4500 },
  { typ: 'TLF 3000', kategorie: 'Löschfahrzeug', wachenArt: 'Feuerwache', preis: 5500 },
  { typ: 'TLF 4000', kategorie: 'Löschfahrzeug', wachenArt: 'Feuerwache', preis: 7000 },
  { typ: 'DLK 23/12', kategorie: 'Drehleiter', wachenArt: 'Feuerwache', preis: 9000 },
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

export interface FahrzeugBedarf {
  id: string;
  category: FahrzeugKategorie;
  amount: number;
}

export interface AlarmiertesFahrzeug {
  vehicleId: string;
  distanceKm: number;
  etaSeconds: number;
  arrivalAt: number;
}

/** Basisdaten eines Einsatzes – so liefert ihn aktuell auch der Server. */
export interface Einsatz {
  id: string;
  /** Alarmstichwort, z. B. "RD 1" oder "B 1" */
  stichwort: string;
  /** Klartext-Meldebild, z. B. "Gestürzte Person" */
  meldebild: string;
  status: EinsatzStatus;
}

export function formatEinsatzTitel(einsatz: Pick<Einsatz, 'stichwort' | 'meldebild'>): string {
  return `${einsatz.stichwort} – ${einsatz.meldebild}`;
}

/** Vollständiger Einsatz, wie ihn die Spiellogik verwendet. */
export interface SpielEinsatz extends Einsatz {
  organization: EinsatzOrganisation;
  coords: [number, number];
  address: string;
  generatedByStationId: string;
  generatedByStationName: string;
  requiredVehicles: FahrzeugBedarf[];
  alarmedVehicles: AlarmiertesFahrzeug[];
  reward: number;
  durationSeconds: number;
  createdAt: number;
  processingStartedAt?: number;
  processingEndsAt?: number;
  completedAt?: number;
  totalDurationSeconds?: number;
  /** Vorlage, aus der der Einsatz (zuletzt) entstanden ist – wichtig für Eskalationen */
  vorlageId: string;
  /** Lagemeldungen während des Einsatzes, z. B. bei einer Eskalation */
  meldungen: EinsatzMeldung[];
  /** Falls gesetzt: Anteil der Bearbeitungszeit (0–1), nach dem der Einsatz eskaliert */
  eskalationBei?: number;
  /** Neue Meldung, die der Spieler noch nicht angesehen hat */
  neueMeldung?: boolean;
  /** Falls gesetzt: Zeitpunkt, zu dem der Einsatz eskaliert, wenn bis dahin niemand alarmiert wurde */
  eskalationOhneAlarmAt?: number;
}

export interface EinsatzMeldung {
  zeit: number;
  text: string;
}

export type WachenArt = 'Rettungswache' | 'Feuerwache';

/** Vorlage, aus der die Spiellogik neue Einsätze erzeugt. */
export interface EinsatzVorlage {
  id: string;
  stichwort: string;
  meldebild: string;
  organization: EinsatzOrganisation;
  requiredVehicles: FahrzeugBedarf[];
  reward: number;
  durationSeconds: number;
  /** Möglicher Übergang in einen größeren Einsatz während der Bearbeitung */
  eskalation?: EinsatzEskalation;
}

export interface EinsatzEskalation {
  zielVorlageId: string;
  /** Wahrscheinlichkeit (0–1), dass dieser Einsatz eskaliert */
  wahrscheinlichkeit: number;
  meldung: string;
}

export const EINSATZ_VORLAGEN: Record<WachenArt, EinsatzVorlage[]> = {
  Rettungswache: [
    {
      id: 'kreislaufprobleme',
      stichwort: 'RD 1',
      meldebild: 'Kreislaufprobleme',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 240,
      durationSeconds: 11,
      eskalation: {
        zielVorlageId: 'reanimation',
        wahrscheinlichkeit: 0.2,
        meldung: 'Patient wird bewusstlos, keine normale Atmung – Reanimation!',
      },
    },
    {
      id: 'gestuerzte-person',
      stichwort: 'RD 1',
      meldebild: 'Gestürzte Person',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 220,
      durationSeconds: 10,
      eskalation: {
        zielVorlageId: 'bewusstlose-person',
        wahrscheinlichkeit: 0.15,
        meldung: 'Patient nach dem Sturz nicht mehr ansprechbar.',
      },
    },
    {
      id: 'atemnot',
      stichwort: 'RD 1',
      meldebild: 'Atemnot',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 260,
      durationSeconds: 12,
      eskalation: {
        zielVorlageId: 'bewusstlose-person',
        wahrscheinlichkeit: 0.25,
        meldung: 'Patient trübt ein und ist nicht mehr ansprechbar.',
      },
    },
    {
      id: 'brustschmerzen',
      stichwort: 'RD 2',
      meldebild: 'Brustschmerzen',
      organization: 'Rettungsdienst',
      requiredVehicles: [
        { id: 'req-rtw', category: 'RTW', amount: 1 },
        { id: 'req-nef', category: 'NEF', amount: 1 },
      ],
      reward: 380,
      durationSeconds: 15,
      eskalation: {
        zielVorlageId: 'reanimation',
        wahrscheinlichkeit: 0.2,
        meldung: 'Patient kollabiert – Reanimation eingeleitet.',
      },
    },
    {
      id: 'schnittverletzung',
      stichwort: 'RD 1',
      meldebild: 'Schnittverletzung',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 230,
      durationSeconds: 9,
    },
    {
      id: 'sturz',
      stichwort: 'RD 1',
      meldebild: 'Sturz',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 220,
      durationSeconds: 10,
      eskalation: {
        zielVorlageId: 'bewusstlose-person',
        wahrscheinlichkeit: 0.15,
        meldung: 'Patient nach dem Sturz bewusstlos.',
      },
    },
    {
      id: 'bewusstlose-person',
      stichwort: 'RD 2',
      meldebild: 'Bewusstlose Person',
      organization: 'Rettungsdienst',
      requiredVehicles: [
        { id: 'req-rtw', category: 'RTW', amount: 1 },
        { id: 'req-nef', category: 'NEF', amount: 1 },
      ],
      reward: 360,
      durationSeconds: 14,
    },
    {
      id: 'reanimation',
      stichwort: 'RD 2',
      meldebild: 'Reanimation',
      organization: 'Rettungsdienst',
      requiredVehicles: [
        { id: 'req-rtw', category: 'RTW', amount: 1 },
        { id: 'req-nef', category: 'NEF', amount: 1 },
      ],
      reward: 450,
      durationSeconds: 18,
    },
  ],
  Feuerwache: [
    {
      id: 'brennender-papierkorb',
      stichwort: 'B 1',
      meldebild: 'Brennender Papierkorb',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 220,
      durationSeconds: 10,
    },
    {
      id: 'brennende-muelltonne',
      stichwort: 'B 1',
      meldebild: 'Brennende Mülltonne',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 240,
      durationSeconds: 11,
    },
    {
      id: 'heckenbrand',
      stichwort: 'B 1',
      meldebild: 'Heckenbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 260,
      durationSeconds: 12,
      eskalation: {
        zielVorlageId: 'garagenbrand',
        wahrscheinlichkeit: 0.25,
        meldung: 'Feuer greift auf eine angrenzende Garage über.',
      },
    },
    {
      id: 'brennender-pkw',
      stichwort: 'B 1',
      meldebild: 'Brennender PKW',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 310,
      durationSeconds: 15,
      eskalation: {
        zielVorlageId: 'garagenbrand',
        wahrscheinlichkeit: 0.25,
        meldung: 'Feuer greift vom PKW auf die Garage über.',
      },
    },
    {
      id: 'unklare-rauchentwicklung',
      stichwort: 'B 1',
      meldebild: 'Unklare Rauchentwicklung',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 290,
      durationSeconds: 14,
      eskalation: {
        zielVorlageId: 'zimmerbrand',
        wahrscheinlichkeit: 0.35,
        meldung: 'Bestätigter Wohnungsbrand, Rauch dringt aus dem Fenster.',
      },
    },
    {
      id: 'muelleimerbrand',
      stichwort: 'B 1',
      meldebild: 'Mülleimerbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 250,
      durationSeconds: 12,
    },
    {
      id: 'kleinbrand',
      stichwort: 'B 1',
      meldebild: 'Kleinbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 300,
      durationSeconds: 14,
      eskalation: {
        zielVorlageId: 'kellerbrand',
        wahrscheinlichkeit: 0.25,
        meldung: 'Feuer hat sich in den Keller ausgebreitet.',
      },
    },
    {
      id: 'garagenbrand',
      stichwort: 'B 2',
      meldebild: 'Garagenbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 2 }],
      reward: 480,
      durationSeconds: 18,
    },
    {
      id: 'kellerbrand',
      stichwort: 'B 2',
      meldebild: 'Kellerbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 2 }],
      reward: 520,
      durationSeconds: 20,
      eskalation: {
        zielVorlageId: 'zimmerbrand',
        wahrscheinlichkeit: 0.2,
        meldung: 'Feuer greift über das Treppenhaus auf eine Wohnung über.',
      },
    },
    {
      id: 'zimmerbrand',
      stichwort: 'B 2',
      meldebild: 'Zimmerbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [
        { id: 'req-lz', category: 'Löschfahrzeug', amount: 2 },
        { id: 'req-dlk', category: 'Drehleiter', amount: 1 },
      ],
      reward: 650,
      durationSeconds: 24,
    },
  ],
};

export function findeEinsatzVorlage(id: string): EinsatzVorlage | undefined {
  return [...EINSATZ_VORLAGEN.Rettungswache, ...EINSATZ_VORLAGEN.Feuerwache].find((vorlage) => vorlage.id === id);
}

/** Würfelt aus, ob (und wann während der Bearbeitung) ein Einsatz aus dieser Vorlage eskaliert. */
/**
 * Würfelt aus, ob (und wann) ein Einsatz eskaliert, wenn sich niemand um ihn kümmert.
 * Nicht jeder Einsatz eskaliert – nur Vorlagen mit Eskalationsstufe und auch dann nur mit deren Wahrscheinlichkeit.
 */
export function planeEskalationOhneAlarm(vorlage: EinsatzVorlage, jetzt: number): number | undefined {
  if (!vorlage.eskalation || Math.random() >= vorlage.eskalation.wahrscheinlichkeit) return undefined;
  const { eskalationOhneAlarmMinMs: min, eskalationOhneAlarmMaxMs: max } = GAME_CONFIG;
  return jetzt + min + Math.random() * (max - min);
}

export function planeEskalation(vorlage: EinsatzVorlage): number | undefined {
  if (!vorlage.eskalation || Math.random() >= vorlage.eskalation.wahrscheinlichkeit) return undefined;
  return 0.3 + Math.random() * 0.4;
}

/**
 * Lässt einen Einsatz in die Ziel-Vorlage eskalieren: neues Stichwort, neue Anforderungen und Belohnung.
 * Bereits alarmierte Fahrzeuge bleiben am Einsatz; fehlende müssen nachalarmiert werden.
 */
export function eskaliereEinsatz(einsatz: SpielEinsatz, ziel: EinsatzVorlage, meldung: string, jetzt: number): SpielEinsatz {
  return {
    ...einsatz,
    vorlageId: ziel.id,
    stichwort: ziel.stichwort,
    meldebild: ziel.meldebild,
    requiredVehicles: ziel.requiredVehicles,
    reward: ziel.reward,
    durationSeconds: ziel.durationSeconds,
    status: einsatz.alarmedVehicles.length > 0 ? 'alarmiert' : 'offen',
    processingStartedAt: undefined,
    processingEndsAt: undefined,
    eskalationBei: planeEskalation(ziel),
    eskalationOhneAlarmAt: planeEskalationOhneAlarm(ziel, jetzt),
    neueMeldung: true,
    meldungen: [...einsatz.meldungen, { zeit: jetzt, text: meldung }],
  };
}

/** Prüft, ob die vorhandenen Fahrzeugtypen alle Anforderungen einer Vorlage grundsätzlich erfüllen können. */
export function istVorlageErfuellbar(vorlage: EinsatzVorlage, fahrzeugTypen: Array<string | undefined>): boolean {
  return vorlage.requiredVehicles.every((bedarf) => {
    const anzahl = fahrzeugTypen.filter((typ) => getFahrzeugKategorie(typ) === bedarf.category).length;
    return anzahl >= bedarf.amount;
  });
}

export interface BedarfsAbdeckung {
  category: FahrzeugKategorie;
  amount: number;
  /** Anzahl bereits alarmierter Fahrzeuge dieser Kategorie */
  alarmiert: number;
}

/** Wie viele der benötigten Fahrzeuge sind einem Einsatz bereits zugeteilt? */
export function getBedarfsAbdeckung(
  einsatz: SpielEinsatz,
  fahrzeuge: Array<{ id: string; type?: string }>,
): BedarfsAbdeckung[] {
  const alarmierteKategorien = einsatz.alarmedVehicles.map((assignment) =>
    getFahrzeugKategorie(fahrzeuge.find((fahrzeug) => fahrzeug.id === assignment.vehicleId)?.type),
  );
  return einsatz.requiredVehicles.map((bedarf) => ({
    category: bedarf.category,
    amount: bedarf.amount,
    alarmiert: alarmierteKategorien.filter((kategorie) => kategorie === bedarf.category).length,
  }));
}

export type AbgeschlossenerSpielEinsatz = SpielEinsatz & {
  completedAt: number;
  totalDurationSeconds: number;
};

export interface GameUser {
  id: string;
  username: string;
  role?: UserRole;
  organizationId?: string;
  displayName?: string;
}

export function getAppInfo(): AppInfo {
  return {
    name: APP_NAME,
    subtitle: APP_SUBTITLE,
    version: APP_VERSION,
  };
}
