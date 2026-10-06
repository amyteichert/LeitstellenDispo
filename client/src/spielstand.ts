import { migriereSpielstand, type Spielstand } from '@leitstellendispo/shared';

// Aufbau, Version und Migration des Spielstands liegen in shared (reine Funktionen, getestet)
export { SPIELSTAND_VERSION, type Spielstand } from '@leitstellendispo/shared';

/**
 * Speicherort für den Spielstand.
 * Asynchron, damit später ein Server-Speicher (fetch auf eine API) dieselbe Schnittstelle erfüllen kann.
 */
export interface SpielstandSpeicher {
  laden(): Promise<Spielstand | null>;
  speichern(spielstand: Spielstand): Promise<void>;
  loeschen(): Promise<void>;
}

const LOCAL_STORAGE_KEY = 'leitstellendispo.spielstand';

/** Speichert den Spielstand im Browser (localStorage). */
export const localStorageSpeicher: SpielstandSpeicher = {
  async laden() {
    try {
      const roh = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!roh) return null;
      const spielstand = migriereSpielstand(JSON.parse(roh));
      if (!spielstand) console.warn('Gespeicherter Spielstand ist unbekannt oder beschädigt und wird ignoriert.');
      return spielstand;
    } catch (error) {
      console.error('Spielstand konnte nicht geladen werden:', error);
      return null;
    }
  },

  async speichern(spielstand) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(spielstand));
    } catch (error) {
      console.error('Spielstand konnte nicht gespeichert werden:', error);
    }
  },

  async loeschen() {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (error) {
      console.error('Spielstand konnte nicht gelöscht werden:', error);
    }
  },
};

/** Aktuell verwendeter Speicher – später hier gegen einen Server-Speicher austauschen. */
export const spielstandSpeicher: SpielstandSpeicher = localStorageSpeicher;
