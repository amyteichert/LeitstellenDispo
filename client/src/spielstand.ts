import type { AbgeschlossenerSpielEinsatz, SpielEinsatz } from '@leitstellendispo/shared';
import type { FinanceTransaction, MapLocation } from './types';
import type { Vehicle } from './views/FahrzeugeView';

/** Wird erhöht, wenn sich der Aufbau des Spielstands inkompatibel ändert. */
export const SPIELSTAND_VERSION = 2;

/** Alles, was zum Fortsetzen eines Spiels gespeichert werden muss. */
export interface Spielstand {
  version: number;
  gespeichertAm: string;
  balance: number;
  transactions: FinanceTransaction[];
  locations: MapLocation[];
  vehicles: Vehicle[];
  incidents: SpielEinsatz[];
  completedIncidentHistory: AbgeschlossenerSpielEinsatz[];
}

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
      const spielstand = JSON.parse(roh) as Spielstand;
      if (spielstand.version !== SPIELSTAND_VERSION) {
        console.warn('Gespeicherter Spielstand hat eine alte Version und wird ignoriert.');
        return null;
      }
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
