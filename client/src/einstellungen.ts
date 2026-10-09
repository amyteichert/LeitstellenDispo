import { useSyncExternalStore } from 'react';

/** Einstellungen, die nur auf diesem Gerät gelten (im Browser gespeichert). */
export interface GeraeteEinstellungen {
  ton: boolean;
  /** 0–1 */
  lautstaerke: number;
  vibration: boolean;
  kompakt: boolean;
  /** Wofür Einblendungen kommen: alle neuen Einsätze und Meldungen, nur wichtige Meldungen oder gar keine */
  hinweise: 'alle' | 'wichtig' | 'aus';
  hinweisDauerSekunden: number;
  /** Karte startet an der zuletzt angezeigten Stelle */
  karteMerken: boolean;
}

export const STANDARD_EINSTELLUNGEN: GeraeteEinstellungen = {
  ton: true,
  lautstaerke: 0.7,
  vibration: true,
  kompakt: false,
  hinweise: 'alle',
  hinweisDauerSekunden: 7,
  karteMerken: true,
};

const SCHLUESSEL = 'leitstellendispo.einstellungen';
/** Frühere, einzelne Einstellung für den Gong */
const ALTER_TON_SCHLUESSEL = 'leitstellendispo.ton';

const lade = (): GeraeteEinstellungen => {
  try {
    const gespeichert = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? 'null') as Partial<GeraeteEinstellungen> | null;
    if (gespeichert) return { ...STANDARD_EINSTELLUNGEN, ...gespeichert };
    return { ...STANDARD_EINSTELLUNGEN, ton: localStorage.getItem(ALTER_TON_SCHLUESSEL) !== 'aus' };
  } catch {
    return STANDARD_EINSTELLUNGEN;
  }
};

let aktuell = lade();
const zuhoerer = new Set<() => void>();

export const getEinstellungen = () => aktuell;

export function setEinstellungen(aenderung: Partial<GeraeteEinstellungen>) {
  aktuell = { ...aktuell, ...aenderung };
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(aktuell));
  } catch {
    // Gilt dann nur bis zum Neuladen
  }
  zuhoerer.forEach((zuhoeren) => zuhoeren());
}

const abonniere = (zuhoeren: () => void) => {
  zuhoerer.add(zuhoeren);
  return () => zuhoerer.delete(zuhoeren);
};

/** Aktuelle Geräte-Einstellungen; Komponenten aktualisieren sich bei Änderungen automatisch. */
export const useEinstellungen = () => useSyncExternalStore(abonniere, getEinstellungen);
