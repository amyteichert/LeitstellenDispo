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
