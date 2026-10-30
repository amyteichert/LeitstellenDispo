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

/** Vorschläge für die Lackfarbe der Fahrzeuge – frei wählen geht auch */
export const FAHRZEUG_FARBEN = [
  { name: 'Feuerwehrrot', farbe: '#c62828' },
  { name: 'Leuchtrot', farbe: '#ef4444' },
  { name: 'Weiß', farbe: '#f8fafc' },
  { name: 'Gelb', farbe: '#f5c400' },
  { name: 'Orange', farbe: '#ea580c' },
  { name: 'Blau', farbe: '#1d4ed8' },
  { name: 'Grün', farbe: '#15803d' },
  { name: 'Silber', farbe: '#9ca3af' },
  { name: 'Schwarz', farbe: '#1f2937' },
] as const;

/** Helle Farbe (z. B. Weiß, Gelb)? Dann braucht Schrift darauf eine dunkle Farbe. */
export function istHelleFarbe(farbe: string): boolean {
  const wert = (i: number) => parseInt(farbe.slice(i, i + 2), 16) / 255;
  const linear = (k: number) => (k <= 0.04045 ? k / 12.92 : ((k + 0.055) / 1.055) ** 2.4);
  const helligkeit = 0.2126 * linear(wert(1)) + 0.7152 * linear(wert(3)) + 0.0722 * linear(wert(5));
  return helligkeit > 0.4;
}

/** Gut lesbare Schriftfarbe auf diesem Grund */
export const getSchriftFarbe = (grund: string) => (istHelleFarbe(grund) ? '#1f2937' : '#ffffff');

/** Lackfarbe eines Fahrzeugs: eigene Wahl, sonst die der Wache – undefined = Standard der Organisation */
export function getFahrzeugFarbe(
  fahrzeug: Pick<Vehicle, 'farbe' | 'stationId'>,
  wachen: Array<Pick<MapLocation, 'id' | 'fahrzeugFarbe'>>,
): string | undefined {
  if (istLogoFarbe(fahrzeug.farbe)) return fahrzeug.farbe;
  const wachenFarbe = wachen.find((wache) => wache.id === fahrzeug.stationId)?.fahrzeugFarbe;
  return istLogoFarbe(wachenFarbe) ? wachenFarbe : undefined;
}

/**
 * Name und Logo-Farbe einer Wache ändern. `logoFarbe: null` setzt auf Standard zurück.
 * Gibt die geänderte Wache oder eine Fehlermeldung zurück.
 */
export function mitWachenAnpassung(
  wache: MapLocation,
  aenderung: { name?: string; logoFarbe?: string | null; fahrzeugFarbe?: string | null },
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
  if (aenderung.fahrzeugFarbe === null) {
    delete neu.fahrzeugFarbe;
  } else if (aenderung.fahrzeugFarbe !== undefined) {
    if (!istLogoFarbe(aenderung.fahrzeugFarbe)) return { fehler: 'Ungültige Fahrzeugfarbe.' };
    neu.fahrzeugFarbe = aenderung.fahrzeugFarbe.toLowerCase();
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

// ---------------------------------------------------------------------------
// Sonder-Erweiterungen: schalten Sonderfahrzeuge frei (einmal bauen, dann dauerhaft)
// ---------------------------------------------------------------------------

export type SonderErweiterungId =
  | 'hubschrauberlandeplatz'
  | 'fuehrungsdienst'
  | 'seg'
  | 'fuehrungsstelle'
  | 'logistik'
  | 'gefahrgut'
  | 'wasserrettung'
  | 'hoehenrettung';

export interface SonderErweiterung {
  id: SonderErweiterungId;
  name: string;
  text: string;
  wachenArt: WachenArt;
  preis: number;
}

export const SONDER_ERWEITERUNGEN: SonderErweiterung[] = [
  { id: 'hubschrauberlandeplatz', name: 'Hubschrauberlandeplatz', text: 'Landeplatz mit Hangar – Voraussetzung für den Rettungshubschrauber.', wachenArt: 'Rettungswache', preis: 150000 },
  { id: 'fuehrungsdienst', name: 'Führungsdienst', text: 'Büro für Leitenden Notarzt und Organisatorischen Leiter.', wachenArt: 'Rettungswache', preis: 30000 },
  { id: 'seg', name: 'Schnelleinsatzgruppe (SEG)', text: 'Lager und Halle für Material bei vielen Verletzten.', wachenArt: 'Rettungswache', preis: 35000 },
  { id: 'fuehrungsstelle', name: 'Führungsstelle', text: 'Technik und Platz für den Einsatzleitwagen 2.', wachenArt: 'Feuerwache', preis: 50000 },
  { id: 'logistik', name: 'Logistik & Sondertechnik', text: 'Große Halle für Schlauchwagen, Logistik-Fahrzeug und Feuerwehrkran.', wachenArt: 'Feuerwache', preis: 45000 },
  { id: 'gefahrgut', name: 'Gefahrgutzug', text: 'Ausrüstung und Lager für Gefahrgut- und Messfahrzeuge.', wachenArt: 'Feuerwache', preis: 60000 },
  { id: 'wasserrettung', name: 'Wasserrettung', text: 'Bootshalle und Tauchausrüstung.', wachenArt: 'Feuerwache', preis: 40000 },
  { id: 'hoehenrettung', name: 'Höhenrettung', text: 'Übungsturm und Seiltechnik für die Höhenrettungsgruppe.', wachenArt: 'Feuerwache', preis: 45000 },
];

export const getSonderErweiterung = (id: string) => SONDER_ERWEITERUNGEN.find((eintrag) => eintrag.id === id);

export const getSonderErweiterungenFuerWache = (wache: Pick<MapLocation, 'stationKind'>) =>
  SONDER_ERWEITERUNGEN.filter((eintrag) => eintrag.wachenArt === (wache.stationKind ?? 'Rettungswache'));

export const hatSonderErweiterung = (wache: Pick<MapLocation, 'ausbau'>, id: SonderErweiterungId) => (wache.ausbau?.[id] ?? 0) > 0;

/** Wache mit gebauter Sonder-Erweiterung – oder eine Fehlermeldung. */
export function mitSonderErweiterung(wache: MapLocation, id: string): { wache: MapLocation } | { fehler: string } {
  const erweiterung = getSonderErweiterung(id);
  if (!erweiterung) return { fehler: 'Erweiterung nicht gefunden.' };
  if (erweiterung.wachenArt !== (wache.stationKind ?? 'Rettungswache')) return { fehler: `${erweiterung.name} gibt es nur an einer ${erweiterung.wachenArt}.` };
  if (hatSonderErweiterung(wache, erweiterung.id)) return { fehler: `${erweiterung.name} ist schon gebaut.` };
  return { wache: { ...wache, ausbau: { ...wache.ausbau, [erweiterung.id]: 1 } } };
}
