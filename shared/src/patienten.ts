/**
 * Patienten im Rettungsdienst – bewusst ein schlanker MVP:
 * Zustand → Behandlung vor Ort → (ggf.) Transport ins Krankenhaus → Übergabe.
 * Ein Einsatz kann mehrere Patienten haben.
 */
import type { Koordinaten } from './typen.js';
import type { Fachrichtung } from './krankenhaeuser.js';

export type PatientenZustand = 'leicht' | 'mittel' | 'schwer' | 'kritisch';

export const PATIENTEN_ZUSTAND_LABELS: Record<PatientenZustand, string> = {
  leicht: 'leicht verletzt/erkrankt',
  mittel: 'mittelschwer',
  schwer: 'schwer verletzt/erkrankt',
  kritisch: 'lebensbedrohlich',
};

const ZUSTAND_REIHENFOLGE: PatientenZustand[] = ['leicht', 'mittel', 'schwer', 'kritisch'];

export const schwererZustand = (a: PatientenZustand, b: PatientenZustand): PatientenZustand =>
  ZUSTAND_REIHENFOLGE.indexOf(a) >= ZUSTAND_REIHENFOLGE.indexOf(b) ? a : b;

export type PatientenStatus =
  | 'wartet'
  | 'in_behandlung'
  | 'transport'
  | 'uebergabe'
  | 'uebergeben'
  | 'ambulant';

export const PATIENTEN_STATUS_LABELS: Record<PatientenStatus, string> = {
  wartet: 'Wartet auf Rettungsdienst',
  in_behandlung: 'In Behandlung',
  transport: 'Transport ins Krankenhaus',
  uebergabe: 'Übergabe im Krankenhaus',
  uebergeben: 'Im Krankenhaus aufgenommen',
  ambulant: 'Ambulant versorgt (kein Transport)',
};

export interface PatientenTransport {
  fahrzeugId: string;
  krankenhausId: string;
  krankenhausName: string;
  /** Koordinaten des Krankenhauses (für Karte und Rückfahrt) */
  ziel: Koordinaten;
  startAt: number;
  ankunftAt: number;
  uebergabeBis: number;
}

export interface Patient {
  id: string;
  zustand: PatientenZustand;
  transportErforderlich: boolean;
  /** Braucht eine bestimmte Fachrichtung (z. B. Herzkatheter) */
  fachrichtung?: Fachrichtung;
  status: PatientenStatus;
  transport?: PatientenTransport;
}

/** Angaben einer Einsatzvorlage zu ihren Patienten */
export interface PatientenVorgabe {
  anzahl: number;
  zustand: PatientenZustand;
  /** Wahrscheinlichkeit (0–1), dass ein Patient ins Krankenhaus muss */
  transportWahrscheinlichkeit: number;
  fachrichtung?: Fachrichtung;
}

export function erzeugePatienten(
  vorgabe: PatientenVorgabe | undefined,
  einsatzId: string,
  zufall: () => number = Math.random,
  startIndex = 0,
): Patient[] {
  if (!vorgabe) return [];
  return Array.from({ length: vorgabe.anzahl }, (_, index) => ({
    id: `${einsatzId}-p${startIndex + index + 1}`,
    zustand: vorgabe.zustand,
    transportErforderlich: zufall() < vorgabe.transportWahrscheinlichkeit,
    ...(vorgabe.fachrichtung ? { fachrichtung: vorgabe.fachrichtung } : {}),
    status: 'wartet' as const,
  }));
}

/** Ist der Patient fertig (im Krankenhaus oder vor Ort abschließend versorgt)? */
export const istPatientAbgeschlossen = (patient: Patient) => patient.status === 'uebergeben' || patient.status === 'ambulant';

/** Status eines Patienten auf dem Transport zum Zeitpunkt `jetzt` */
export function getTransportStatus(transport: PatientenTransport, jetzt: number): PatientenStatus {
  if (jetzt >= transport.uebergabeBis) return 'uebergeben';
  if (jetzt >= transport.ankunftAt) return 'uebergabe';
  return 'transport';
}
