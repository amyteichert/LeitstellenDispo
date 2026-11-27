import type { Adresse, OrtsArt } from './adressen.js';
import type { FahrzeugBedarf } from './fahrzeuge.js';
import type { Patient, PatientenVorgabe } from './patienten.js';
import type { Fachrichtung } from './krankenhaeuser.js';
import type { EinsatzOrganisation, WachenArt } from './typen.js';

export const APP_NAME = 'LeitstellenDispo';
export const APP_SUBTITLE = 'Deine Leitstelle. Deine Einsätze. Deine Entscheidungen.';
export const APP_VERSION = '0.2.0-beta';

export type UserRole = 'player' | 'tester' | 'admin' | 'co_owner' | 'owner';

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

export interface Station {
  id: string;
  name: string;
  organizationId?: string;
  location?: GameLocation;
  description?: string;
}

export type EinsatzStatus = 'offen' | 'alarmiert' | 'in_bearbeitung' | 'transport' | 'abgeschlossen';

export const EINSATZ_STATUS_LABELS: Record<EinsatzStatus, string> = {
  offen: 'Offen',
  alarmiert: 'Fahrzeuge alarmiert',
  in_bearbeitung: 'In Bearbeitung',
  transport: 'Patiententransport',
  abgeschlossen: 'Abgeschlossen',
};

/** Startguthaben für ein neues Spiel */
export const START_GUTHABEN = 20000;

/** Baukosten je Wachenart */
export const WACHEN_PREISE: Record<WachenArt, number> = {
  Rettungswache: 8000,
  Feuerwache: 15000,
};

/** Die allererste Wache kostet höchstens so viel – damit man mit dem Startguthaben samt Startfahrzeug beginnen kann */
export const ERSTE_WACHE_HOECHSTPREIS = 10000;

/** Baukosten einer neuen Wache; `bisherigeWachen` = wie viele der Spieler schon hat */
export const getWachenPreis = (art: WachenArt, bisherigeWachen: number) =>
  bisherigeWachen === 0 ? Math.min(WACHEN_PREISE[art], ERSTE_WACHE_HOECHSTPREIS) : WACHEN_PREISE[art];

export interface AlarmiertesFahrzeug {
  vehicleId: string;
  distanceKm: number;
  etaSeconds: number;
  arrivalAt: number;
  /** Startpunkt der Anfahrt, wenn das Fahrzeug nicht von der Wache kam (z. B. auf der Rückfahrt alarmiert) */
  startCoords?: [number, number];
  /** Gesetzt, sobald das Fahrzeug vom Einsatz entlassen wurde (z. B. NEF nach der Behandlung, RTW nach der Übergabe) */
  freigegebenAt?: number;
}

/** Basisdaten eines Einsatzes – so liefert ihn aktuell auch der Server. */
export interface Einsatz {
  id: string;
  /** Alarmstichwort, z. B. "RD 1" oder "B 1" */
  stichwort: string;
  /** Klartext-Meldebild, z. B. "Gestürzte Person" */
  meldebild: string;
  status: EinsatzStatus;
  /** Einsatzadresse als Text */
  address?: string;
}

/** Geldbetrag im deutschen Format, z. B. „20.000 €“ */
export function formatEuro(betrag: number): string {
  return `${betrag.toLocaleString('de-DE')} €`;
}

export function formatEinsatzTitel(einsatz: Pick<Einsatz, 'stichwort' | 'meldebild'>): string {
  return `${einsatz.stichwort} – ${einsatz.meldebild}`;
}

/** Vollständiger Einsatz, wie ihn die Spiellogik verwendet. */
export interface SpielEinsatz extends Einsatz {
  organization: EinsatzOrganisation;
  /** Einsatzort: `coords` und `adresse` gehören zusammen; `address` ist die formatierte Adresse */
  coords: [number, number];
  address: string;
  adresse?: Adresse;
  /** Adresse wurde mit der echten Karte abgeglichen (Straße, PLZ, Ort am Einsatzort) */
  adresseGeprueft?: boolean;
  generatedByStationId: string;
  generatedByStationName: string;
  requiredVehicles: FahrzeugBedarf[];
  alarmedVehicles: AlarmiertesFahrzeug[];
  reward: number;
  durationSeconds: number;
  createdAt: number;
  processingStartedAt?: number;
  processingEndsAt?: number;
  /** Zeitpunkt, an dem der Einsatz vollständig erledigt ist (bei Transporten: nach der letzten Übergabe) */
  abschlussAt?: number;
  completedAt?: number;
  totalDurationSeconds?: number;
  /** Vorlage, aus der der Einsatz (zuletzt) entstanden ist – wichtig für Eskalationen */
  vorlageId: string;
  /** Lagemeldungen, zeitlich sortiert (älteste zuerst) */
  meldungen: EinsatzMeldung[];
  /** Falls gesetzt: Anteil der Bearbeitungszeit (0–1), nach dem der Einsatz eskaliert */
  eskalationBei?: number;
  /** Neue wichtige Meldung, die der Spieler noch nicht angesehen hat */
  neueMeldung?: boolean;
  /** Durch Einsatzdruck entstanden: Dem Spieler fehlen (noch) passende Fahrzeuge */
  fehlendeKraefte?: boolean;
  /** Früherer Verfall als üblich (z. B. bei Einsätzen mit fehlenden Kräften) */
  verfallAt?: number;
  /** An die Nachbarleitstelle abgegeben: wird beim nächsten Tick ohne Vergütung entfernt */
  abgegebenAt?: number;
  /** Krankenhausverlegung: Patient wird von Haus A (Einsatzort) in Haus B mit der fehlenden Abteilung gebracht */
  verlegung?: EinsatzVerlegung;
  /** Falls gesetzt: Zeitpunkt, zu dem der Einsatz eskaliert, wenn bis dahin niemand alarmiert wurde */
  eskalationOhneAlarmAt?: number;
  /** Patienten (Rettungsdienst). Fehlt bei älteren Spielständen. */
  patienten?: Patient[];
  /** Ankunft des ersten Fahrzeugs (erste Lagemeldung von der Einsatzstelle) */
  erstesEintreffenAt?: number;
  /** Ausgewürfelt: Das erste Fahrzeug fordert bei Eintreffen weitere Kräfte nach */
  nachforderungGeplant?: boolean;
  /** Ausgewürfelt: Die Lage vor Ort ist kleiner als gemeldet, ein Teil der Kräfte kann abrücken */
  entwarnungGeplant?: boolean;
  /** Meldung ist unklar – der Bedarf ist nur eine Empfehlung und kann sich vor Ort ändern */
  meldungUnklar?: boolean;
  /** Anfahrtszeit des schnellsten freien passenden Fahrzeugs bei der Erstalarmierung */
  besteAnfahrtSekunden?: number;
  /** Bedarf laut Erstmeldung (Empfehlung bei der Alarmierung) */
  empfehlung?: FahrzeugBedarf[];
  /** Leistungsbewertung – wird beim Abschluss gesetzt */
  bewertung?: EinsatzBewertung;
  /** Gehört zu einer Großschadenslage (ein Einsatzabschnitt von mehreren) */
  grosslage?: EinsatzGrosslage;
}

/** Zuordnung eines Einsatzes zu einer Großschadenslage. Jeder Abschnitt ist ein normaler Einsatz. */
export interface EinsatzGrosslage {
  /** Gemeinsam für alle Abschnitte derselben Lage */
  id: string;
  /** Vorlage der Lage (siehe GROSSLAGEN_VORLAGEN) */
  vorlageId: string;
  /** Name der Lage, z. B. „Zugunglück“ */
  name: string;
  /** Name dieses Abschnitts, z. B. „Abschnitt Patientenablage“ */
  abschnitt: string;
  /** 1 = sofort gemeldet, 2 = entsteht erst nach der Erkundung durch die ersten Kräfte */
  welle: 1 | 2;
  /** Mittelpunkt der Schadensstelle – die Abschnitte liegen darum herum */
  zentrum: [number, number];
  /** Die zweite Welle ist bereits entstanden */
  welle2?: boolean;
  /** Ein Abschnitt ist verfallen oder wurde abgegeben – kein Abschlussbonus */
  unvollstaendig?: boolean;
}

/** Bewertung eines abgeschlossenen Einsatzes: Grundgeld gibt es immer, der Bonus hängt von Leistung und Ruf ab. */
export interface EinsatzVerlegung {
  vonKrankenhausId: string;
  nachKrankenhausId: string;
  nachKrankenhausName: string;
  fachrichtung: Fachrichtung;
}

export interface EinsatzBewertung {
  /** 0–100 = Fahrzeugwahl + Hilfsfrist − Abzug für unnötig viele Kräfte */
  punkte: number;
  /** So viele Fahrzeuge mehr als nötig (über eine erlaubte Reserve hinaus) – fehlt bei älteren Einsätzen */
  ueberzaehlig?: number;
  /** Punktabzug dafür */
  ueberAbzug?: number;
  /** 0–50: Wurde das nächste freie Fahrzeug geschickt? */
  wahlPunkte: number;
  /** 0–50: Wie schnell war das erste Fahrzeug da? */
  fristPunkte: number;
  /** Zeit von der ersten Alarmierung bis zum Eintreffen des ersten Fahrzeugs */
  anfahrtSekunden: number;
  /** So schnell wäre das beste freie Fahrzeug gewesen (fehlt bei älteren Einsätzen) */
  besteAnfahrtSekunden?: number;
  grundgeld: number;
  bonus: number;
  /** Ruf vor diesem Einsatz */
  rufVorher: number;
  rufAenderung: number;
}

/** Art einer Lagemeldung – wichtige Meldungen lösen einen Hinweis aus */
export type MeldungsArt = 'eskalation' | 'nachforderung' | 'entwarnung' | 'lage' | 'patient' | 'abschluss';

export interface EinsatzMeldung {
  zeit: number;
  text: string;
  /** Fehlt bei älteren Spielständen (dort waren es immer Eskalationen) */
  art?: MeldungsArt;
}

export const istWichtigeMeldung = (meldung: EinsatzMeldung) =>
  meldung.art === undefined || meldung.art === 'eskalation' || meldung.art === 'nachforderung';

/** Ist der Einsatz seit der Alarmierung eskaliert (größeres Stichwort)? */
export const istEskaliert = (einsatz: Pick<SpielEinsatz, 'meldungen'>) =>
  einsatz.meldungen.some((meldung) => meldung.art === undefined || meldung.art === 'eskalation');

/** Hängt Meldungen an und hält die Liste zeitlich sortiert (wichtig beim Nachholen von Offline-Zeit). */
export function fuegeMeldungenHinzu(meldungen: EinsatzMeldung[], neue: EinsatzMeldung[]): EinsatzMeldung[] {
  if (neue.length === 0) return meldungen;
  return [...meldungen, ...neue].sort((a, b) => a.zeit - b.zeit);
}

/** Vorlage, aus der die Spiellogik neue Einsätze erzeugt. */
export interface EinsatzVorlage {
  id: string;
  stichwort: string;
  meldebild: string;
  organization: EinsatzOrganisation;
  requiredVehicles: FahrzeugBedarf[];
  reward: number;
  durationSeconds: number;
  /** Wie der Einsatzort beschrieben wird (Standard: Gebäude mit Hausnummer) */
  ortsArt?: OrtsArt;
  /** Patienten, die versorgt werden müssen */
  patienten?: PatientenVorgabe;
  /** Erste Lagemeldung beim Eintreffen */
  lage?: string;
  /** Mögliche Nachforderung durch das erste Fahrzeug vor Ort */
  nachforderung?: EinsatzNachforderung;
  /** Möglicher Übergang in einen größeren Einsatz während der Bearbeitung */
  eskalation?: EinsatzEskalation;
  /** Mögliche Entwarnung beim Eintreffen: weniger Kräfte nötig als gemeldet */
  entwarnung?: EinsatzEntwarnung;
  /** Meldebild ist von Natur aus unklar (auch ohne Nachforderung/Entwarnung als Hinweis anzeigen) */
  unklar?: boolean;
  /** Entsteht erst, wenn der Spieler ein eigenes Krankenhaus hat (z. B. Krankentransporte) */
  brauchtEigenesKrankenhaus?: boolean;
  /** Verlegung zwischen zwei eigenen Häusern: Einsatzort und Ziel werden beim Erzeugen festgelegt */
  verlegung?: boolean;
}

export interface EinsatzEntwarnung {
  wahrscheinlichkeit: number;
  /** Diese Kräfte werden nicht gebraucht und rücken ab */
  abzug: FahrzeugBedarf[];
  meldung: string;
}

export interface EinsatzEskalation {
  zielVorlageId: string;
  /** Wahrscheinlichkeit (0–1), dass dieser Einsatz eskaliert */
  wahrscheinlichkeit: number;
  meldung: string;
}

export interface EinsatzNachforderung {
  wahrscheinlichkeit: number;
  bedarf: FahrzeugBedarf[];
  meldung: string;
  /** Zusätzliche Belohnung für den aufwendigeren Einsatz */
  zusatzBelohnung: number;
}

export type AbgeschlossenerSpielEinsatz = SpielEinsatz & {
  completedAt: number;
  totalDurationSeconds: number;
};

export function getAppInfo(): AppInfo {
  return {
    name: APP_NAME,
    subtitle: APP_SUBTITLE,
    version: APP_VERSION,
  };
}
