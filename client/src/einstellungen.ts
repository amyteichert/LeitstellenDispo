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
  /** Wie oft neue Einsätze kommen: Faktor auf das normale Aufkommen */
  einsatzTempo: number;
  /** Pause: Es gehen keine neuen Einsätze ein – laufende Einsätze, Fahrten und Timer laufen normal weiter */
  einsatzPause: boolean;
  /** Farbdesign des Spiels (Farben stehen in index.css unter html[data-design=…]) */
  design: Design;
}

export type Design = 'leitstelle' | 'blau' | 'rot' | 'lila' | 'gruen' | 'schwarz' | 'hell';

/** Auswahl in den Einstellungen – `farbe` ist nur die Vorschau-Kachel */
export const DESIGNS: Array<{ wert: Design; text: string; farbe: string; hintergrund: string }> = [
  { wert: 'leitstelle', text: 'Leitstelle (Logo)', farbe: '#e8121f', hintergrund: '#050506' },
  { wert: 'blau', text: 'Neon-Blau', farbe: '#0a7cff', hintergrund: '#0a101b' },
  { wert: 'rot', text: 'Neon-Rot', farbe: '#ff2d55', hintergrund: '#12080b' },
  { wert: 'lila', text: 'Neon-Lila', farbe: '#b14dff', hintergrund: '#0e0816' },
  { wert: 'gruen', text: 'Neon-Grün', farbe: '#1fd655', hintergrund: '#06100a' },
  { wert: 'schwarz', text: 'Schwarz', farbe: '#0a7cff', hintergrund: '#000000' },
  { wert: 'hell', text: 'Hell', farbe: '#0a66d6', hintergrund: '#f5f7fa' },
];

export const EINSATZ_TEMPI: Array<{ wert: number; text: string; info: string }> = [
  { wert: 0.5, text: 'Ruhig', info: 'halb so viele Einsätze' },
  { wert: 1, text: 'Normal', info: 'wie im echten Leitstellenalltag' },
  { wert: 1.5, text: 'Belebt', info: 'eineinhalbmal so viele' },
  { wert: 2, text: 'Viel los', info: 'doppelt so viele Einsätze' },
];

export const STANDARD_EINSTELLUNGEN: GeraeteEinstellungen = {
  ton: true,
  lautstaerke: 0.7,
  vibration: true,
  kompakt: false,
  hinweise: 'alle',
  hinweisDauerSekunden: 7,
  karteMerken: true,
  einsatzTempo: 1,
  einsatzPause: false,
  design: 'leitstelle',
};

const SCHLUESSEL = 'leitstellendispo.einstellungen';
/** Frühere, einzelne Einstellung für den Gong */
const ALTER_TON_SCHLUESSEL = 'leitstellendispo.ton';

/** Merker für die einmalige Umstellung von Blau (alter Standard) auf das Logo-Design */
const DESIGN_UMSTELLUNG_SCHLUESSEL = 'leitstellendispo.design-umstellung-2026-11';

const lade = (): GeraeteEinstellungen => {
  try {
    const gespeichert = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? 'null') as Partial<GeraeteEinstellungen> | null;
    // Blau war bis November 2026 der Standard: wer noch darauf steht, bekommt einmalig das Logo-Design.
    // Wer danach wieder Blau wählt, behält es (der Merker verhindert eine erneute Umstellung).
    if (localStorage.getItem(DESIGN_UMSTELLUNG_SCHLUESSEL) !== 'erledigt') {
      if (gespeichert?.design === 'blau') {
        gespeichert.design = 'leitstelle';
        localStorage.setItem(SCHLUESSEL, JSON.stringify(gespeichert));
      }
      localStorage.setItem(DESIGN_UMSTELLUNG_SCHLUESSEL, 'erledigt');
    }
    if (gespeichert) return { ...STANDARD_EINSTELLUNGEN, ...gespeichert };
    return { ...STANDARD_EINSTELLUNGEN, ton: localStorage.getItem(ALTER_TON_SCHLUESSEL) !== 'aus' };
  } catch {
    return STANDARD_EINSTELLUNGEN;
  }
};

/** Setzt das Design am <html>-Element – auch schon vor der Anmeldung */
const wendeDesignAn = (design: Design) => {
  if (typeof document === 'undefined') return;
  const gueltig = DESIGNS.some((d) => d.wert === design) ? design : STANDARD_EINSTELLUNGEN.design;
  document.documentElement.dataset.design = gueltig;
  const hintergrund = DESIGNS.find((d) => d.wert === gueltig)?.hintergrund;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hintergrund ?? '#050506');
};

let aktuell = lade();
wendeDesignAn(aktuell.design);
const zuhoerer = new Set<() => void>();

export const getEinstellungen = () => aktuell;

export function setEinstellungen(aenderung: Partial<GeraeteEinstellungen>) {
  aktuell = { ...aktuell, ...aenderung };
  if (aenderung.design) wendeDesignAn(aenderung.design);
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
