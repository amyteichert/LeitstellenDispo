// Sicherungen der Datenbank: regelmäßig automatisch auf dem Server, dazu Download für den Owner
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Datenbank } from './datenbank.js';

/** Alle 6 Stunden eine Sicherung, die letzten 14 bleiben liegen (gut 3 Tage) */
export const SICHERUNG_INTERVALL_MS = 6 * 60 * 60 * 1000;
export const SICHERUNG_ANZAHL = 14;

const DATEI_MUSTER = /^leitstellendispo-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/;

/** Dateiname mit Zeitstempel (UTC), sortiert sich alphabetisch = zeitlich */
export const sicherungsName = (jetzt: Date) =>
  `leitstellendispo-${jetzt.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')}.db`;

/** Vorhandene Sicherungen, neueste zuerst */
export function listeSicherungen(ordner: string): string[] {
  try {
    return readdirSync(ordner).filter((name) => DATEI_MUSTER.test(name)).sort().reverse();
  } catch {
    return [];
  }
}

/**
 * Legt eine Sicherung an (SQLite-Backup – konsistent, auch während der Server schreibt)
 * und löscht ältere als die letzten `behalten`. Gibt den Pfad der neuen Sicherung zurück.
 */
export async function legeSicherungAn(db: Datenbank, ordner: string, behalten = SICHERUNG_ANZAHL, jetzt = new Date()): Promise<string> {
  mkdirSync(ordner, { recursive: true });
  const ziel = join(ordner, sicherungsName(jetzt));
  await db.backup(ziel);
  for (const alt of listeSicherungen(ordner).slice(behalten)) rmSync(join(ordner, alt), { force: true });
  return ziel;
}

/** Sichert sofort und danach regelmäßig. Fehler werden nur protokolliert – das Spiel läuft weiter. */
export function starteAutomatischeSicherung(db: Datenbank, ordner: string): void {
  const sichern = () =>
    legeSicherungAn(db, ordner).then(
      (pfad) => console.log(`Sicherung angelegt: ${pfad}`),
      (fehler: unknown) => console.error('Sicherung fehlgeschlagen:', fehler),
    );
  void sichern();
  setInterval(sichern, SICHERUNG_INTERVALL_MS).unref();
}
