/**
 * Fahrzeuggrafik-Katalog: Spieler laden Bilder ihrer Fahrzeuge hoch, alle können sie verwenden.
 * Jeder Spieler wählt je Fahrzeugtyp (und optional je Fahrzeug) eine Grafik – ohne Wahl gilt die gezeichnete Standardgrafik.
 */
import { getFahrzeugTyp } from './fahrzeuge.js';

/** Hochgeladene Grafiken werden im Browser auf diese Breite verkleinert (Seitenansicht, ca. 2:1) */
export const FAHRZEUGGRAFIK_BREITE = 480;
export const FAHRZEUGGRAFIK_HOEHE = 240;
export const FAHRZEUGGRAFIK_MAX_BYTES = 120_000;
export const FAHRZEUGGRAFIK_NAME_MAX_LAENGE = 40;
/** So viele Grafiken darf ein Konto hochladen (gelöschte zählen nicht) */
export const FAHRZEUGGRAFIKEN_JE_KONTO = 40;

export interface Fahrzeuggrafik {
  id: number;
  /** Was das Fahrzeug ist – vom Spieler benannt, z. B. „HLF 20 Berufsfeuerwehr“ */
  name: string;
  /** Fahrzeugtyp aus dem Katalog, z. B. „HLF 20“ */
  fahrzeugTyp: string;
  /** Anzeigename des Spielers, der sie hochgeladen hat */
  vonName: string;
  vonId: number | null;
  /** ISO-Zeitpunkt */
  erstellt: string;
  /** Vom Team freigegeben – vorher sehen sie nur der Hochladende und das Team */
  geprueft: boolean;
}

/** Gewählte Grafiken eines Spielers: Fahrzeugtyp → Grafik-ID (fehlt = Standardgrafik) */
export type GrafikAuswahl = Record<string, number>;

/** Prüft Name und Typ einer neuen Grafik. Gibt die Fehlermeldung zurück oder null. */
export function pruefeFahrzeuggrafik(name: unknown, fahrzeugTyp: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) return 'Bitte gib der Grafik einen Namen.';
  if (name.trim().length > FAHRZEUGGRAFIK_NAME_MAX_LAENGE) return `Der Name darf höchstens ${FAHRZEUGGRAFIK_NAME_MAX_LAENGE} Zeichen haben.`;
  if (typeof fahrzeugTyp !== 'string' || !getFahrzeugTyp(fahrzeugTyp)) return 'Unbekannter Fahrzeugtyp.';
  return null;
}

/** Welche Grafik ein Fahrzeug zeigt: eigene Wahl am Fahrzeug, sonst die Wahl für den Typ, sonst Standard (undefined). */
export const getGewaehlteGrafik = (
  fahrzeug: { type?: string; grafikId?: number },
  auswahl: GrafikAuswahl | undefined,
): number | undefined => fahrzeug.grafikId ?? (fahrzeug.type ? auswahl?.[fahrzeug.type] : undefined);
