/**
 * Wachenverwaltung: Stellplätze und Ausbau.
 * Reine Funktionen – der Client ruft sie auf, ein Server könnte dasselbe tun.
 */
import type { MapLocation, Vehicle, WachenArt } from './typen.js';

export const STELLPLATZ_CONFIG = {
  /** Stellplätze einer neuen Wache */
  basis: { Rettungswache: 2, Feuerwache: 3 } as Record<WachenArt, number>,
  /** So oft kann eine Wache erweitert werden */
  maxErweiterungen: 8,
  /** Preis der ersten Erweiterung … */
  erstePreis: 20000,
  /** … jede weitere kostet so viel mal mehr */
  preisFaktor: 1.6,
} as const;

export const WACHENNAME_MAX_LAENGE = 40;

/** Vorschläge für die Logo-Farbe einer Wache – frei wählen geht auch */
export const WACHEN_LOGO_FARBEN = [
  { name: 'Standard', farbe: '#f4f6f8' },
  { name: 'Rot', farbe: '#fde2e2' },
  { name: 'Orange', farbe: '#ffe8d1' },
  { name: 'Gelb', farbe: '#fff4c2' },
  { name: 'Grün', farbe: '#dcf5e3' },
  { name: 'Blau', farbe: '#dbeafe' },
  { name: 'Lila', farbe: '#ede4ff' },
  { name: 'Dunkel', farbe: '#1f2937' },
] as const;

export const istLogoFarbe = (farbe: unknown): farbe is string => typeof farbe === 'string' && /^#[0-9a-f]{6}$/i.test(farbe);

/**
 * Name und Logo-Farbe einer Wache ändern. `logoFarbe: null` setzt auf Standard zurück.
 * Gibt die geänderte Wache oder eine Fehlermeldung zurück.
 */
export function mitWachenAnpassung(
  wache: MapLocation,
  aenderung: { name?: string; logoFarbe?: string | null },
): { wache: MapLocation } | { fehler: string } {
  const neu = { ...wache };
  if (aenderung.name !== undefined) {
    const name = aenderung.name.trim();
    if (!name) return { fehler: 'Der Name darf nicht leer sein.' };
    if (name.length > WACHENNAME_MAX_LAENGE) return { fehler: `Höchstens ${WACHENNAME_MAX_LAENGE} Zeichen.` };
    neu.name = name;
  }
  if (aenderung.logoFarbe === null || aenderung.logoFarbe === WACHEN_LOGO_FARBEN[0].farbe) {
    delete neu.logoFarbe;
  } else if (aenderung.logoFarbe !== undefined) {
    if (!istLogoFarbe(aenderung.logoFarbe)) return { fehler: 'Ungültige Farbe.' };
    neu.logoFarbe = aenderung.logoFarbe.toLowerCase();
  }
  return { wache: neu };
}

export const getStellplatzErweiterungen = (wache: Pick<MapLocation, 'ausbau'>) => wache.ausbau?.stellplatz ?? 0;

export const getStellplaetze = (wache: Pick<MapLocation, 'stationKind' | 'ausbau'>) =>
  STELLPLATZ_CONFIG.basis[wache.stationKind ?? 'Rettungswache'] + getStellplatzErweiterungen(wache);

export const getBelegteStellplaetze = (wacheId: string, vehicles: Vehicle[]) =>
  vehicles.filter((vehicle) => vehicle.stationId === wacheId).length;

export const hatFreienStellplatz = (wache: MapLocation, vehicles: Vehicle[]) =>
  getBelegteStellplaetze(wache.id, vehicles) < getStellplaetze(wache);

/** Preis der nächsten Stellplatz-Erweiterung – null, wenn die Wache voll ausgebaut ist. */
export function getStellplatzPreis(wache: Pick<MapLocation, 'ausbau'>): number | null {
  const stufe = getStellplatzErweiterungen(wache);
  if (stufe >= STELLPLATZ_CONFIG.maxErweiterungen) return null;
  return Math.round((STELLPLATZ_CONFIG.erstePreis * STELLPLATZ_CONFIG.preisFaktor ** stufe) / 500) * 500;
}

/** Wache mit einem zusätzlichen Stellplatz. */
export const mitStellplatzErweiterung = (wache: MapLocation): MapLocation => ({
  ...wache,
  ausbau: { ...wache.ausbau, stellplatz: getStellplatzErweiterungen(wache) + 1 },
});
