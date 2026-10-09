import { GAME_CONFIG } from './konfig.js';
import type { Adresse, OrtsArt } from './adressen.js';
import {
  ergaenzeBedarf,
  formatBedarfsListe,
  istBedarfGedeckt,
  ordneFahrzeugeBedarfZu,
  type BedarfsKlasse,
  type FahrzeugBedarf,
} from './fahrzeuge.js';
import { erzeugePatienten, schwererZustand, type Patient, type PatientenVorgabe } from './patienten.js';
import type { Fachrichtung } from './krankenhaeuser.js';
import type { EinsatzOrganisation, WachenArt } from './typen.js';

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

export interface AlarmiertesFahrzeug {
  vehicleId: string;
  distanceKm: number;
  etaSeconds: number;
  arrivalAt: number;
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

const RTW = (amount = 1): FahrzeugBedarf => ({ id: 'req-rtw', category: 'RTW', amount });
const NEF = (amount = 1): FahrzeugBedarf => ({ id: 'req-nef', category: 'NEF', amount });
const LF = (amount = 1): FahrzeugBedarf => ({ id: 'req-lz', category: 'Löschfahrzeug', amount });
const DLK = (amount = 1): FahrzeugBedarf => ({ id: 'req-dlk', category: 'Drehleiter', amount });
const TH = (amount = 1): FahrzeugBedarf => ({ id: 'req-th', category: 'Technische Hilfe', amount });
const RG = (amount = 1): FahrzeugBedarf => ({ id: 'req-rg', category: 'Rettungsgerät', amount });
const KT = (amount = 1): FahrzeugBedarf => ({ id: 'req-kt', category: 'Krankentransport', amount });
const RW = (amount = 1): FahrzeugBedarf => ({ id: 'req-rw', category: 'Rüstwagen', amount });
const ELW = (amount = 1): FahrzeugBedarf => ({ id: 'req-elw', category: 'Einsatzleitwagen', amount });

const NEF_NACHFORDERUNG = (wahrscheinlichkeit: number, meldung: string): EinsatzNachforderung => ({
  wahrscheinlichkeit,
  bedarf: [NEF()],
  meldung,
  zusatzBelohnung: 120,
});

export const EINSATZ_VORLAGEN: Record<WachenArt, EinsatzVorlage[]> = {
  Rettungswache: [
    {
      id: 'kreislaufprobleme',
      stichwort: 'RD 1',
      meldebild: 'Kreislaufprobleme',
      organization: 'Rettungsdienst',
      requiredVehicles: [RTW()],
      reward: 240,
      durationSeconds: 11,
      patienten: { anzahl: 1, zustand: 'mittel', transportWahrscheinlichkeit: 0.7, fachrichtung: 'innere' },
      lage: 'Patient blass und kaltschweißig, wird untersucht.',
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
      requiredVehicles: [RTW()],
      reward: 220,
      durationSeconds: 10,
      patienten: { anzahl: 1, zustand: 'leicht', transportWahrscheinlichkeit: 0.6, fachrichtung: 'unfallchirurgie' },
      lage: 'Ältere Person liegt am Boden, ansprechbar.',
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
      requiredVehicles: [RTW()],
      reward: 260,
      durationSeconds: 12,
      patienten: { anzahl: 1, zustand: 'mittel', transportWahrscheinlichkeit: 0.85, fachrichtung: 'innere' },
      lage: 'Patient sitzt am Fenster, deutliche Atemnot.',
      nachforderung: NEF_NACHFORDERUNG(0.2, 'Sauerstoffsättigung fällt weiter, Patient erschöpft – Notarzt erforderlich.'),
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
      requiredVehicles: [RTW(), NEF()],
      reward: 380,
      durationSeconds: 15,
      patienten: { anzahl: 1, zustand: 'schwer', transportWahrscheinlichkeit: 1, fachrichtung: 'kardiologie' },
      lage: 'Patient mit Druck auf der Brust, Verdacht auf Herzinfarkt.',
      entwarnung: {
        wahrscheinlichkeit: 0.25,
        abzug: [NEF()],
        meldung: 'Beschwerden rückläufig, kein Hinweis auf einen Infarkt – NEF kann abrücken.',
      },
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
      requiredVehicles: [RTW()],
      reward: 230,
      durationSeconds: 9,
      patienten: { anzahl: 1, zustand: 'leicht', transportWahrscheinlichkeit: 0.5, fachrichtung: 'unfallchirurgie' },
      lage: 'Blutende Schnittwunde an der Hand, Druckverband angelegt.',
    },
    {
      id: 'sturz',
      stichwort: 'RD 1',
      meldebild: 'Sturz',
      organization: 'Rettungsdienst',
      requiredVehicles: [RTW()],
      reward: 220,
      durationSeconds: 10,
      patienten: { anzahl: 1, zustand: 'leicht', transportWahrscheinlichkeit: 0.65, fachrichtung: 'unfallchirurgie' },
      lage: 'Person nach Sturz auf der Treppe, Schmerzen im Bein.',
      nachforderung: NEF_NACHFORDERUNG(0.15, 'Kopfverletzung, Patient zunehmend eingetrübt – Notarzt erforderlich.'),
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
      requiredVehicles: [RTW(), NEF()],
      reward: 360,
      durationSeconds: 14,
      patienten: { anzahl: 1, zustand: 'schwer', transportWahrscheinlichkeit: 1, fachrichtung: 'neurologie' },
      lage: 'Person nicht ansprechbar, Atmung vorhanden.',
      entwarnung: {
        wahrscheinlichkeit: 0.3,
        abzug: [NEF()],
        meldung: 'Person ist wieder wach und orientiert – NEF kann abrücken.',
      },
    },
    {
      id: 'reanimation',
      stichwort: 'RD 2',
      meldebild: 'Reanimation',
      organization: 'Rettungsdienst',
      requiredVehicles: [RTW(), NEF()],
      reward: 450,
      durationSeconds: 18,
      patienten: { anzahl: 1, zustand: 'kritisch', transportWahrscheinlichkeit: 1, fachrichtung: 'kardiologie' },
      lage: 'Laienreanimation läuft, Übernahme durch den Rettungsdienst.',
    },
    {
      id: 'verkehrsunfall-rd',
      stichwort: 'RD 2',
      meldebild: 'Verkehrsunfall mit Verletzten',
      organization: 'Rettungsdienst',
      requiredVehicles: [RTW(2)],
      reward: 520,
      durationSeconds: 16,
      ortsArt: 'kreuzung',
      patienten: { anzahl: 2, zustand: 'mittel', transportWahrscheinlichkeit: 0.9, fachrichtung: 'unfallchirurgie' },
      lage: 'Zwei PKW kollidiert, zwei Verletzte außerhalb der Fahrzeuge.',
      nachforderung: NEF_NACHFORDERUNG(0.25, 'Ein Patient mit Verdacht auf innere Blutung – Notarzt erforderlich.'),
    },
    {
      id: 'allergische-reaktion',
      stichwort: 'RD 1',
      meldebild: 'Allergische Reaktion',
      organization: 'Rettungsdienst',
      requiredVehicles: [RTW()],
      reward: 250,
      durationSeconds: 11,
      patienten: { anzahl: 1, zustand: 'mittel', transportWahrscheinlichkeit: 0.75, fachrichtung: 'innere' },
      lage: 'Schwellung im Gesicht nach Wespenstich, Patient ansprechbar.',
      nachforderung: NEF_NACHFORDERUNG(0.2, 'Atemwege schwellen zu, Kreislauf instabil – Notarzt erforderlich.'),
    },
    {
      id: 'krampfanfall',
      stichwort: 'RD 1',
      meldebild: 'Krampfanfall',
      organization: 'Rettungsdienst',
      requiredVehicles: [RTW()],
      reward: 240,
      durationSeconds: 11,
      patienten: { anzahl: 1, zustand: 'mittel', transportWahrscheinlichkeit: 0.8, fachrichtung: 'neurologie' },
      lage: 'Krampfanfall hat aufgehört, Patient noch schläfrig.',
      eskalation: {
        zielVorlageId: 'bewusstlose-person',
        wahrscheinlichkeit: 0.15,
        meldung: 'Erneuter Krampfanfall – Patient wacht nicht mehr auf.',
      },
    },
    {
      id: 'unterzuckerung',
      stichwort: 'RD 1',
      meldebild: 'Unterzuckerung',
      organization: 'Rettungsdienst',
      requiredVehicles: [RTW()],
      reward: 230,
      durationSeconds: 10,
      patienten: { anzahl: 1, zustand: 'leicht', transportWahrscheinlichkeit: 0.4, fachrichtung: 'innere' },
      lage: 'Diabetiker verwirrt und zittrig, Blutzucker wird gemessen.',
      eskalation: {
        zielVorlageId: 'bewusstlose-person',
        wahrscheinlichkeit: 0.15,
        meldung: 'Patient trübt ein und ist nicht mehr ansprechbar.',
      },
    },
    {
      id: 'hilflose-person',
      stichwort: 'RD 1',
      meldebild: 'Hilflose Person',
      organization: 'Rettungsdienst',
      requiredVehicles: [RTW()],
      reward: 210,
      durationSeconds: 9,
      ortsArt: 'strasse',
      patienten: { anzahl: 1, zustand: 'leicht', transportWahrscheinlichkeit: 0.5, fachrichtung: 'innere' },
      lage: 'Person sitzt hilflos an einer Bushaltestelle, ansprechbar.',
      unklar: true,
    },
    {
      id: 'schlaganfall',
      stichwort: 'RD 2',
      meldebild: 'Verdacht auf Schlaganfall',
      organization: 'Rettungsdienst',
      requiredVehicles: [RTW(), NEF()],
      reward: 400,
      durationSeconds: 15,
      patienten: { anzahl: 1, zustand: 'schwer', transportWahrscheinlichkeit: 1, fachrichtung: 'neurologie' },
      lage: 'Hängender Mundwinkel und Sprachstörung seit einer halben Stunde.',
      entwarnung: {
        wahrscheinlichkeit: 0.3,
        abzug: [NEF()],
        meldung: 'Patient stabil – Transport in die Stroke Unit ohne Notarzt, NEF kann abrücken.',
      },
    },
    {
      id: 'sturz-aus-hoehe',
      stichwort: 'RD 2',
      meldebild: 'Sturz aus Höhe',
      organization: 'Rettungsdienst',
      requiredVehicles: [RTW(), NEF()],
      reward: 420,
      durationSeconds: 16,
      patienten: { anzahl: 1, zustand: 'schwer', transportWahrscheinlichkeit: 1, fachrichtung: 'unfallchirurgie' },
      lage: 'Sturz von der Leiter aus ca. 3 m Höhe, Patient klagt über Rückenschmerzen.',
      entwarnung: {
        wahrscheinlichkeit: 0.3,
        abzug: [NEF()],
        meldung: 'Nur leichte Prellungen, Patient stabil – NEF kann abrücken.',
      },
    },
    {
      id: 'krankentransport',
      stichwort: 'KTP',
      meldebild: 'Krankentransport – Einweisung',
      organization: 'Rettungsdienst',
      requiredVehicles: [KT()],
      brauchtEigenesKrankenhaus: true,
      reward: 160,
      durationSeconds: 8,
      patienten: { anzahl: 1, zustand: 'leicht', transportWahrscheinlichkeit: 1, fachrichtung: 'innere' },
      lage: 'Patientin mit Einweisung vom Hausarzt, gehfähig.',
    },
    {
      id: 'liegendtransport',
      stichwort: 'KTP',
      meldebild: 'Krankentransport – liegend',
      organization: 'Rettungsdienst',
      requiredVehicles: [KT()],
      brauchtEigenesKrankenhaus: true,
      reward: 180,
      durationSeconds: 10,
      patienten: { anzahl: 1, zustand: 'leicht', transportWahrscheinlichkeit: 1, fachrichtung: 'unfallchirurgie' },
      lage: 'Bettlägeriger Patient nach Hüft-OP, Transport mit der Trage.',
    },
    {
      id: 'verlegung',
      stichwort: 'KTP',
      meldebild: 'Krankenhausverlegung',
      organization: 'Rettungsdienst',
      requiredVehicles: [KT()],
      brauchtEigenesKrankenhaus: true,
      verlegung: true,
      reward: 260,
      durationSeconds: 8,
      patienten: { anzahl: 1, zustand: 'mittel', transportWahrscheinlichkeit: 1 },
      lage: 'Patient wird auf Station übernommen und für die Verlegung vorbereitet.',
    },
  ],
  Feuerwache: [
    {
      id: 'brennender-papierkorb',
      stichwort: 'B 1',
      meldebild: 'Brennender Papierkorb',
      organization: 'Feuerwehr',
      requiredVehicles: [LF()],
      reward: 220,
      durationSeconds: 10,
      ortsArt: 'strasse',
    },
    {
      id: 'brennende-muelltonne',
      stichwort: 'B 1',
      meldebild: 'Brennende Mülltonne',
      organization: 'Feuerwehr',
      requiredVehicles: [LF()],
      reward: 240,
      durationSeconds: 11,
    },
    {
      id: 'heckenbrand',
      stichwort: 'B 1',
      meldebild: 'Heckenbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [LF()],
      reward: 260,
      durationSeconds: 12,
      lage: 'Hecke auf ca. 10 m in Brand, Wohnhaus nicht gefährdet.',
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
      requiredVehicles: [LF()],
      reward: 310,
      durationSeconds: 15,
      ortsArt: 'strasse',
      lage: 'PKW im Motorraum in Vollbrand, keine Personen im Fahrzeug.',
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
      requiredVehicles: [LF()],
      reward: 290,
      durationSeconds: 14,
      lage: 'Leichter Brandgeruch im Treppenhaus, Erkundung läuft.',
      unklar: true,
      eskalation: {
        zielVorlageId: 'zimmerbrand',
        wahrscheinlichkeit: 0.35,
        meldung: 'Bestätigter Wohnungsbrand, Rauch dringt aus dem Fenster.',
      },
    },
    {
      id: 'bma-ausgeloest',
      stichwort: 'B BMA',
      meldebild: 'Brandmeldeanlage ausgelöst',
      organization: 'Feuerwehr',
      requiredVehicles: [LF(2)],
      reward: 260,
      durationSeconds: 12,
      lage: 'Brandmeldeanlage ausgelöst, Erkundung im Gebäude läuft.',
      unklar: true,
      entwarnung: {
        wahrscheinlichkeit: 0.75,
        abzug: [LF()],
        meldung: 'Fehlalarm – Melder durch Wasserdampf ausgelöst, ein Fahrzeug kann einrücken.',
      },
      eskalation: {
        zielVorlageId: 'zimmerbrand',
        wahrscheinlichkeit: 0.1,
        meldung: 'Kein Fehlalarm: Brand im 2. OG bestätigt!',
      },
    },
    {
      id: 'muelleimerbrand',
      stichwort: 'B 1',
      meldebild: 'Mülleimerbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [LF()],
      reward: 250,
      durationSeconds: 12,
      ortsArt: 'strasse',
    },
    {
      id: 'kleinbrand',
      stichwort: 'B 1',
      meldebild: 'Kleinbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [LF()],
      reward: 300,
      durationSeconds: 14,
      lage: 'Kleinbrand im Hinterhof, Löschangriff mit einem C-Rohr.',
      nachforderung: {
        wahrscheinlichkeit: 0.15,
        bedarf: [LF()],
        meldung: 'Brand größer als gemeldet, Holzlager betroffen – weiteres Löschfahrzeug erforderlich.',
        zusatzBelohnung: 150,
      },
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
      requiredVehicles: [LF(2)],
      reward: 480,
      durationSeconds: 18,
      lage: 'Garage in Vollbrand, Riegelstellung zum Wohnhaus.',
      entwarnung: {
        wahrscheinlichkeit: 0.25,
        abzug: [LF()],
        meldung: 'Nur Mülltonnen vor der Garage in Brand – ein Löschfahrzeug kann abrücken.',
      },
    },
    {
      id: 'kellerbrand',
      stichwort: 'B 2',
      meldebild: 'Kellerbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [LF(2)],
      reward: 520,
      durationSeconds: 20,
      lage: 'Starke Verrauchung im Keller, Trupp unter Atemschutz geht vor.',
      entwarnung: {
        wahrscheinlichkeit: 0.25,
        abzug: [LF()],
        meldung: 'Nur verschmortes Kabel im Kellerraum, kaum Rauch – ein Löschfahrzeug kann abrücken.',
      },
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
      requiredVehicles: [LF(2), DLK()],
      reward: 650,
      durationSeconds: 24,
      lage: 'Rauch aus Fenster im 2. OG, Menschenrettung über Drehleiter wird vorbereitet.',
      entwarnung: {
        wahrscheinlichkeit: 0.2,
        abzug: [DLK()],
        meldung: 'Bewohner haben die Wohnung selbst verlassen – Drehleiter kann abrücken.',
      },
      eskalation: {
        zielVorlageId: 'gebaeudebrand',
        wahrscheinlichkeit: 0.15,
        meldung: 'Feuer hat den Dachstuhl erreicht – Gebäudebrand!',
      },
    },
    {
      id: 'gebaeudebrand',
      stichwort: 'B 3',
      meldebild: 'Gebäudebrand',
      organization: 'Feuerwehr',
      requiredVehicles: [LF(3), DLK()],
      reward: 950,
      durationSeconds: 32,
      lage: 'Mehrfamilienhaus, Flammen aus mehreren Fenstern, Bewohner an den Fenstern.',
      entwarnung: {
        wahrscheinlichkeit: 0.2,
        abzug: [LF()],
        meldung: 'Brand auf eine Wohnung begrenzt – ein Löschfahrzeug kann abrücken.',
      },
      eskalation: {
        zielVorlageId: 'grossbrand',
        wahrscheinlichkeit: 0.1,
        meldung: 'Brand breitet sich auf das Nachbarhaus aus – Großbrand, Einsatzleitung erforderlich!',
      },
    },
    {
      id: 'grossbrand',
      stichwort: 'B 4',
      meldebild: 'Großbrand – mehrere Gebäude',
      organization: 'Feuerwehr',
      requiredVehicles: [LF(4), DLK(2), ELW()],
      reward: 1600,
      durationSeconds: 45,
      lage: 'Zwei Wohnhäuser in Vollbrand, Abschnitte werden gebildet.',
    },
    {
      id: 'brand-lagerhalle',
      stichwort: 'B 4',
      meldebild: 'Brand in Lagerhalle',
      organization: 'Feuerwehr',
      requiredVehicles: [LF(3), DLK(), ELW()],
      reward: 1350,
      durationSeconds: 40,
      lage: 'Rauchsäule weithin sichtbar, Halle mit Lagerware in Vollbrand.',
      entwarnung: {
        wahrscheinlichkeit: 0.2,
        abzug: [DLK()],
        meldung: 'Dach hält, Brandbekämpfung nur von außen – Drehleiter kann abrücken.',
      },
    },
    {
      id: 'oelspur',
      stichwort: 'TH 1',
      meldebild: 'Ölspur',
      organization: 'Feuerwehr',
      requiredVehicles: [TH()],
      reward: 200,
      durationSeconds: 12,
      ortsArt: 'strasse',
      lage: 'Ölspur auf ca. 200 m, Bindemittel wird aufgebracht.',
    },
    {
      id: 'baum-auf-strasse',
      stichwort: 'TH 1',
      meldebild: 'Baum auf Straße',
      organization: 'Feuerwehr',
      requiredVehicles: [TH()],
      reward: 240,
      durationSeconds: 14,
      ortsArt: 'strasse',
      lage: 'Baum blockiert beide Fahrspuren, Motorsäge im Einsatz.',
    },
    {
      id: 'verkehrsunfall-th',
      stichwort: 'TH 1',
      meldebild: 'Verkehrsunfall, auslaufende Betriebsstoffe',
      organization: 'Feuerwehr',
      requiredVehicles: [TH()],
      reward: 280,
      durationSeconds: 14,
      ortsArt: 'kreuzung',
      lage: 'Zwei PKW, Betriebsstoffe laufen aus, Brandschutz sichergestellt.',
      eskalation: {
        zielVorlageId: 'vu-eingeklemmt',
        wahrscheinlichkeit: 0.15,
        meldung: 'Bei der Erkundung: Fahrer im Fahrzeug eingeklemmt!',
      },
    },
    {
      id: 'person-hinter-tuer',
      stichwort: 'TH 1',
      meldebild: 'Person hinter verschlossener Tür',
      organization: 'Feuerwehr',
      requiredVehicles: [TH(), RTW()],
      reward: 330,
      durationSeconds: 12,
      patienten: { anzahl: 1, zustand: 'mittel', transportWahrscheinlichkeit: 0.6, fachrichtung: 'innere' },
      lage: 'Hilferufe aus der Wohnung, Tür wird geöffnet.',
      unklar: true,
    },
    {
      id: 'vu-eingeklemmt',
      stichwort: 'TH 2',
      meldebild: 'VU – Person eingeklemmt',
      organization: 'Feuerwehr',
      requiredVehicles: [RG(), LF(), RTW()],
      reward: 700,
      durationSeconds: 26,
      ortsArt: 'kreuzung',
      patienten: { anzahl: 1, zustand: 'schwer', transportWahrscheinlichkeit: 1, fachrichtung: 'unfallchirurgie' },
      lage: 'PKW gegen Baum, Fahrer eingeklemmt, technische Rettung wird vorbereitet.',
      nachforderung: NEF_NACHFORDERUNG(0.5, 'Eingeklemmter Fahrer mit schweren Verletzungen – Notarzt erforderlich.'),
    },
    {
      id: 'containerbrand',
      stichwort: 'B 1',
      meldebild: 'Containerbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [LF()],
      reward: 270,
      durationSeconds: 13,
      ortsArt: 'strasse',
      lage: 'Altpapiercontainer brennt in voller Ausdehnung, Fassade nicht gefährdet.',
    },
    {
      id: 'heimrauchmelder',
      stichwort: 'B 1',
      meldebild: 'Heimrauchmelder ausgelöst',
      organization: 'Feuerwehr',
      requiredVehicles: [LF()],
      reward: 230,
      durationSeconds: 11,
      lage: 'Rauchmelder piept hinter der Wohnungstür, niemand öffnet.',
      unklar: true,
      eskalation: {
        zielVorlageId: 'zimmerbrand',
        wahrscheinlichkeit: 0.12,
        meldung: 'Tür geöffnet: Wohnung verraucht, Feuer im Wohnzimmer – Zimmerbrand!',
      },
    },
    {
      id: 'flaechenbrand',
      stichwort: 'B 2',
      meldebild: 'Flächenbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [LF(2)],
      reward: 480,
      durationSeconds: 22,
      ortsArt: 'strasse',
      lage: 'Böschung brennt auf ca. 300 m², Feuer breitet sich mit dem Wind aus.',
      entwarnung: {
        wahrscheinlichkeit: 0.25,
        abzug: [LF()],
        meldung: 'Feuer schnell unter Kontrolle – ein Löschfahrzeug kann abrücken.',
      },
    },
    {
      id: 'kuechenbrand-verletzt',
      stichwort: 'B 2',
      meldebild: 'Küchenbrand, Person verletzt',
      organization: 'Feuerwehr',
      requiredVehicles: [LF(2), RTW()],
      reward: 640,
      durationSeconds: 22,
      patienten: { anzahl: 1, zustand: 'mittel', transportWahrscheinlichkeit: 0.9, fachrichtung: 'unfallchirurgie' },
      lage: 'Brennendes Fett auf dem Herd, Bewohnerin mit Brandverletzungen an der Hand.',
      eskalation: {
        zielVorlageId: 'gebaeudebrand',
        wahrscheinlichkeit: 0.1,
        meldung: 'Feuer greift über den Dunstabzug auf die Nachbarwohnung über – Gebäudebrand!',
      },
    },
    {
      id: 'wasserschaden',
      stichwort: 'TH 1',
      meldebild: 'Wasserschaden',
      organization: 'Feuerwehr',
      requiredVehicles: [TH()],
      reward: 220,
      durationSeconds: 12,
      lage: 'Wasser tritt aus der Decke, Hauptwasserhahn wird gesucht.',
    },
    {
      id: 'tier-in-notlage',
      stichwort: 'TH 1',
      meldebild: 'Tier in Notlage',
      organization: 'Feuerwehr',
      requiredVehicles: [TH()],
      reward: 190,
      durationSeconds: 10,
      lage: 'Hund im Kellerschacht eingeklemmt, Besitzer vor Ort.',
    },
    {
      id: 'sturmschaden',
      stichwort: 'TH 1',
      meldebild: 'Sturmschaden – lose Dachziegel',
      organization: 'Feuerwehr',
      requiredVehicles: [TH(), DLK()],
      reward: 380,
      durationSeconds: 16,
      lage: 'Dachziegel drohen auf den Gehweg zu fallen, Sicherung über die Drehleiter.',
    },
    {
      id: 'baum-auf-pkw',
      stichwort: 'TH 2',
      meldebild: 'Baum auf PKW, Person eingeklemmt',
      organization: 'Feuerwehr',
      requiredVehicles: [RW(), LF(), RTW()],
      reward: 780,
      durationSeconds: 26,
      ortsArt: 'strasse',
      patienten: { anzahl: 1, zustand: 'schwer', transportWahrscheinlichkeit: 1, fachrichtung: 'unfallchirurgie' },
      lage: 'Baum liegt auf dem Fahrzeugdach, Fahrerin eingeklemmt – Rüstwagen hebt den Stamm an.',
      nachforderung: NEF_NACHFORDERUNG(0.4, 'Fahrerin mit Kopfverletzung, zunehmend eingetrübt – Notarzt erforderlich.'),
    },
    {
      id: 'lkw-unfall',
      stichwort: 'TH 2',
      meldebild: 'LKW-Unfall, Fahrer eingeklemmt',
      organization: 'Feuerwehr',
      requiredVehicles: [RW(), LF(2), RTW()],
      reward: 900,
      durationSeconds: 30,
      ortsArt: 'kreuzung',
      patienten: { anzahl: 1, zustand: 'schwer', transportWahrscheinlichkeit: 1, fachrichtung: 'unfallchirurgie' },
      lage: 'LKW gegen Brückenpfeiler, Fahrerhaus stark deformiert, Diesel läuft aus.',
      nachforderung: NEF_NACHFORDERUNG(0.5, 'Fahrer schwer verletzt, Kreislauf instabil – Notarzt erforderlich.'),
    },
    {
      id: 'vu-mehrere-verletzte',
      stichwort: 'TH 3',
      meldebild: 'Verkehrsunfall mit mehreren Verletzten',
      organization: 'Feuerwehr',
      requiredVehicles: [ELW(), RW(), LF(), RTW(3), NEF()],
      reward: 1700,
      durationSeconds: 34,
      ortsArt: 'kreuzung',
      patienten: { anzahl: 3, zustand: 'mittel', transportWahrscheinlichkeit: 0.9, fachrichtung: 'unfallchirurgie' },
      lage: 'Kleinbus und PKW kollidiert, drei Verletzte, einer davon eingeklemmt.',
    },
  ],
};

export const ALLE_EINSATZ_VORLAGEN: EinsatzVorlage[] = [...EINSATZ_VORLAGEN.Rettungswache, ...EINSATZ_VORLAGEN.Feuerwache];

export function findeEinsatzVorlage(id: string): EinsatzVorlage | undefined {
  return ALLE_EINSATZ_VORLAGEN.find((vorlage) => vorlage.id === id);
}

/**
 * Würfelt aus, ob (und wann) ein Einsatz eskaliert, wenn sich niemand um ihn kümmert.
 * Nicht jeder Einsatz eskaliert – nur Vorlagen mit Eskalationsstufe und auch dann nur mit deren Wahrscheinlichkeit.
 */
export function planeEskalationOhneAlarm(vorlage: EinsatzVorlage, jetzt: number): number | undefined {
  if (!vorlage.eskalation || Math.random() >= vorlage.eskalation.wahrscheinlichkeit) return undefined;
  const { eskalationOhneAlarmMinMs: min, eskalationOhneAlarmMaxMs: max } = GAME_CONFIG;
  return jetzt + min + Math.random() * (max - min);
}

/** Würfelt aus, ob (und wann während der Bearbeitung) ein Einsatz aus dieser Vorlage eskaliert. */
export function planeEskalation(vorlage: EinsatzVorlage): number | undefined {
  if (!vorlage.eskalation || Math.random() >= vorlage.eskalation.wahrscheinlichkeit) return undefined;
  return 0.3 + Math.random() * 0.4;
}

/** Würfelt aus, ob das erste Fahrzeug vor Ort weitere Kräfte nachfordert. */
export function planeNachforderung(vorlage: EinsatzVorlage, zufall: () => number = Math.random): boolean {
  return Boolean(vorlage.nachforderung) && zufall() < (vorlage.nachforderung?.wahrscheinlichkeit ?? 0);
}

/** Würfelt aus, ob sich die Lage vor Ort als kleiner herausstellt. Nie zusammen mit einer Nachforderung. */
export function planeEntwarnung(vorlage: EinsatzVorlage, nachforderungGeplant: boolean, zufall: () => number = Math.random): boolean {
  return !nachforderungGeplant && Boolean(vorlage.entwarnung) && zufall() < (vorlage.entwarnung?.wahrscheinlichkeit ?? 0);
}

/** Was beim ersten Eintreffen passieren kann: Nachforderung, Entwarnung oder keins von beiden. */
export function planeLageBeimEintreffen(vorlage: EinsatzVorlage, nochNichtEingetroffen = true) {
  const nachforderungGeplant = nochNichtEingetroffen && planeNachforderung(vorlage);
  return {
    nachforderungGeplant,
    entwarnungGeplant: nochNichtEingetroffen && planeEntwarnung(vorlage, nachforderungGeplant),
  };
}

/** Kann sich der Bedarf dieses Einsatzes vor Ort noch ändern? Dann wird er als „Empfehlung“ angezeigt. */
export const istMeldungUnklar = (vorlage: EinsatzVorlage) =>
  Boolean(vorlage.unklar || vorlage.nachforderung || vorlage.entwarnung);

/** Zieht Bedarf ab (z. B. bei einer Entwarnung); Einträge mit 0 fallen weg. */
export function reduziereBedarf(bedarf: FahrzeugBedarf[], abzug: FahrzeugBedarf[]): FahrzeugBedarf[] {
  return bedarf
    .map((eintrag) => {
      const weniger = abzug.filter((a) => a.category === eintrag.category).reduce((summe, a) => summe + a.amount, 0);
      return { ...eintrag, amount: eintrag.amount - weniger };
    })
    .filter((eintrag) => eintrag.amount > 0);
}

/** Patienten nach einer Eskalation: Zustand verschlechtert sich, Transport wird nötig, ggf. kommen Patienten dazu. */
function passePatientenAn(einsatz: SpielEinsatz, ziel: EinsatzVorlage): Patient[] | undefined {
  const bisher = einsatz.patienten ?? [];
  if (!ziel.patienten) return einsatz.patienten;
  const angepasst = bisher.map((patient) => ({
    ...patient,
    zustand: schwererZustand(patient.zustand, ziel.patienten!.zustand),
    transportErforderlich: true,
    status: 'wartet' as const,
  }));
  const fehlend = Math.max(0, ziel.patienten.anzahl - angepasst.length);
  return [
    ...angepasst,
    ...erzeugePatienten({ ...ziel.patienten, anzahl: fehlend, transportWahrscheinlichkeit: 1 }, einsatz.id, Math.random, angepasst.length),
  ];
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
    // Nachforderung/Entwarnung gibt es nur beim ersten Eintreffen – danach nicht mehr
    ...planeLageBeimEintreffen(ziel, einsatz.erstesEintreffenAt === undefined),
    empfehlung: ziel.requiredVehicles,
    meldungUnklar: istMeldungUnklar(ziel),
    patienten: passePatientenAn(einsatz, ziel),
    neueMeldung: true,
    meldungen: fuegeMeldungenHinzu(einsatz.meldungen, [{ zeit: jetzt, text: meldung, art: 'eskalation' }]),
  };
}

/** Fügt den Bedarf einer Nachforderung zum Einsatz hinzu (inkl. Lagemeldung). */
export function wendeNachforderungAn(
  einsatz: SpielEinsatz,
  nachforderung: EinsatzNachforderung,
  zeit: number,
  quelle: string,
): SpielEinsatz {
  return {
    ...einsatz,
    requiredVehicles: ergaenzeBedarf(einsatz.requiredVehicles, nachforderung.bedarf),
    reward: einsatz.reward + nachforderung.zusatzBelohnung,
    nachforderungGeplant: false,
    neueMeldung: true,
    meldungen: fuegeMeldungenHinzu(einsatz.meldungen, [{
      zeit,
      text: `${quelle}: ${nachforderung.meldung} Nachforderung: ${formatBedarfsListe(nachforderung.bedarf.map((b) => ({ category: b.category, anzahl: b.amount })))}.`,
      art: 'nachforderung',
    }]),
  };
}

/** Prüft, ob die vorhandenen Fahrzeugtypen alle Anforderungen einer Vorlage grundsätzlich erfüllen können. */
export function istVorlageErfuellbar(vorlage: Pick<EinsatzVorlage, 'requiredVehicles'>, fahrzeugTypen: Array<string | undefined>): boolean {
  return istBedarfGedeckt(vorlage.requiredVehicles, fahrzeugTypen.map((type, index) => ({ id: String(index), type })));
}

/** Zuteilungen, die (noch) zum Einsatz gehören – entlassene Fahrzeuge zählen nicht mehr. */
export const getAktiveZuteilungen = (einsatz: Pick<SpielEinsatz, 'alarmedVehicles'>) =>
  einsatz.alarmedVehicles.filter((assignment) => assignment.freigegebenAt === undefined);

export interface BedarfsAbdeckung {
  category: BedarfsKlasse;
  amount: number;
  /** Anzahl alarmierter Fahrzeuge, die diesen Bedarf decken */
  alarmiert: number;
  /** Davon bereits an der Einsatzstelle */
  vorOrt: number;
}

/**
 * Wie viele der benötigten Fahrzeuge sind einem Einsatz zugeteilt bzw. schon vor Ort?
 * Bei laufendem Transport oder abgeschlossenem Einsatz zählen auch bereits entlassene Fahrzeuge.
 */
export function getBedarfsAbdeckung(
  einsatz: SpielEinsatz,
  fahrzeuge: Array<{ id: string; type?: string }>,
  jetzt: number = Date.now(),
): BedarfsAbdeckung[] {
  const zuteilungen = einsatz.status === 'transport' || einsatz.status === 'abgeschlossen'
    ? einsatz.alarmedVehicles
    : getAktiveZuteilungen(einsatz);
  const zugeteilt = zuteilungen.map((assignment) => ({
    id: assignment.vehicleId,
    type: fahrzeuge.find((fahrzeug) => fahrzeug.id === assignment.vehicleId)?.type,
    angekommen: assignment.arrivalAt <= jetzt,
  }));
  const alarmiert = ordneFahrzeugeBedarfZu(einsatz.requiredVehicles, zugeteilt);
  const vorOrt = ordneFahrzeugeBedarfZu(einsatz.requiredVehicles, zugeteilt.filter((fahrzeug) => fahrzeug.angekommen));
  return einsatz.requiredVehicles.map((bedarf, index) => ({
    category: bedarf.category,
    amount: bedarf.amount,
    alarmiert: alarmiert[index].length,
    vorOrt: vorOrt[index].length,
  }));
}

export interface EinsatzVersorgung {
  abdeckung: BedarfsAbdeckung[];
  /** Was noch alarmiert werden muss */
  fehlendAlarmiert: Array<{ category: BedarfsKlasse; anzahl: number }>;
  /** Was noch nicht an der Einsatzstelle ist */
  fehlendVorOrt: Array<{ category: BedarfsKlasse; anzahl: number }>;
  ausreichendAlarmiert: boolean;
  ausreichendVorOrt: boolean;
}

/** Ist der Einsatz ausreichend versorgt? Grundlage für Anzeige („unterversorgt“) und Vorschlag. */
export function getEinsatzVersorgung(
  einsatz: SpielEinsatz,
  fahrzeuge: Array<{ id: string; type?: string }>,
  jetzt: number = Date.now(),
): EinsatzVersorgung {
  const abdeckung = getBedarfsAbdeckung(einsatz, fahrzeuge, jetzt);
  const fehlendAlarmiert = abdeckung
    .map((eintrag) => ({ category: eintrag.category, anzahl: eintrag.amount - eintrag.alarmiert }))
    .filter((eintrag) => eintrag.anzahl > 0);
  const fehlendVorOrt = abdeckung
    .map((eintrag) => ({ category: eintrag.category, anzahl: eintrag.amount - eintrag.vorOrt }))
    .filter((eintrag) => eintrag.anzahl > 0);
  return {
    abdeckung,
    fehlendAlarmiert,
    fehlendVorOrt,
    ausreichendAlarmiert: fehlendAlarmiert.length === 0,
    ausreichendVorOrt: fehlendVorOrt.length === 0,
  };
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
