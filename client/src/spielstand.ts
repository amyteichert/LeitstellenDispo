import { migriereSpielstand, type Spielstand } from '@leitstellendispo/shared';
import { meldeSitzungAbgelaufen } from './konto';

// Aufbau, Version und Migration des Spielstands liegen in shared (reine Funktionen, getestet)
export { SPIELSTAND_VERSION, type Spielstand } from '@leitstellendispo/shared';

/**
 * Speicherort für den Spielstand.
 * Asynchron, damit später ein Server-Speicher (fetch auf eine API) dieselbe Schnittstelle erfüllen kann.
 */
export interface SpielstandSpeicher {
  /** `null`, wenn es keinen (brauchbaren) Spielstand gibt. Wirft, wenn der Speicher nicht erreichbar ist. */
  laden(): Promise<Spielstand | null>;
  speichern(spielstand: Spielstand): Promise<void>;
  loeschen(): Promise<void>;
  /** Ausstehende Änderungen sofort schicken (falls der Speicher drosselt) */
  sofortSpeichern?(): Promise<void>;
}

const LOCAL_STORAGE_KEY = 'leitstellendispo.spielstand';

/** Speichert den Spielstand im Browser (localStorage). Seit den Benutzerkonten nur noch Quelle für die Übernahme ins Konto. */
export const localStorageSpeicher: SpielstandSpeicher = {
  async laden() {
    try {
      const roh = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!roh) return null;
      return pruefe(JSON.parse(roh));
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

/** Höchstens so oft wird der Spielstand an den Server geschickt (die letzte Änderung gewinnt) */
const SERVER_SPEICHER_INTERVALL_MS = 3000;

/** Ein Spielstand lesbar machen; `null` bei unbekannter oder beschädigter Version */
function pruefe(roh: unknown): Spielstand | null {
  const spielstand = migriereSpielstand(roh);
  if (roh && !spielstand) console.warn('Gespeicherter Spielstand ist unbekannt oder beschädigt und wird ignoriert.');
  return spielstand;
}

/**
 * Speichert den Spielstand im angemeldeten Konto auf dem Server.
 * Änderungen werden gesammelt und gedrosselt verschickt; schlägt das Senden fehl, wird es später erneut versucht.
 */
function erstelleServerSpeicher() {
  let ausstehend: Spielstand | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const planen = () => {
    if (!timer) timer = setTimeout(senden, SERVER_SPEICHER_INTERVALL_MS);
  };

  async function senden(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = null;
    const spielstand = ausstehend;
    ausstehend = null;
    if (!spielstand) return;
    try {
      const res = await fetch('/api/spielstand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spielstand),
      });
      if (res.status === 401) return meldeSitzungAbgelaufen();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (error) {
      console.error('Spielstand konnte nicht gespeichert werden, neuer Versuch folgt:', error);
      ausstehend ??= spielstand; // nur wiederholen, wenn inzwischen nichts Neueres ansteht
      planen();
    }
  }

  // Beim Wechsel in den Hintergrund (Tab, App, Tablet-Sperre) sofort sichern
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void senden();
  });

  const speicher: SpielstandSpeicher & { sofortSpeichern(): Promise<void> } = {
    async laden() {
      // Fehler bewusst weiterreichen: Ein leerer Stand würde sonst den echten Spielstand im Konto überschreiben
      const res = await fetch('/api/spielstand');
      if (res.status === 401) meldeSitzungAbgelaufen();
      if (!res.ok) throw new Error(`Spielstand konnte nicht geladen werden (HTTP ${res.status}).`);
      return pruefe(((await res.json()) as { spielstand: unknown }).spielstand);
    },

    async speichern(spielstand) {
      ausstehend = spielstand;
      planen();
    },

    async loeschen() {
      ausstehend = null;
      if (timer) clearTimeout(timer);
      timer = null;
      try {
        await fetch('/api/spielstand', { method: 'DELETE' });
      } catch (error) {
        console.error('Spielstand konnte nicht gelöscht werden:', error);
      }
    },

    /** Noch ausstehende Änderungen sofort schicken (z. B. vor dem Abmelden) */
    sofortSpeichern: senden,
  };
  return speicher;
}

export const serverSpeicher = erstelleServerSpeicher();

/** Aktuell verwendeter Speicher: das Konto auf dem Server */
export const spielstandSpeicher: SpielstandSpeicher = serverSpeicher;

/** Hierhin wird die alte Browser-Kopie nach der Prüfung verschoben – nicht gelöscht, aber nie wieder übernommen */
const ALT_KEY = 'leitstellendispo.spielstand.alt';

function legeBrowserKopieBeiseite() {
  try {
    const roh = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (roh !== null) localStorage.setItem(ALT_KEY, roh);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // Ohne Browser-Speicher gibt es auch nichts zu übernehmen
  }
}

/**
 * Übernimmt einen Spielstand aus der Zeit vor den Benutzerkonten (localStorage) einmalig ins Konto,
 * sofern das Konto noch keinen eigenen hat. Danach – oder wenn das Konto schon einen hat – wird die Browser-Kopie
 * beiseitegelegt, damit sie nie später (z. B. nach „Neues Spiel“) wieder auftaucht.
 */
export async function uebernimmBrowserSpielstand(): Promise<void> {
  const lokal = await localStorageSpeicher.laden();
  if (!lokal) return;
  try {
    const res = await fetch('/api/spielstand');
    if (!res.ok) return;
    const { spielstand } = (await res.json()) as { spielstand: unknown };
    if (spielstand) {
      legeBrowserKopieBeiseite(); // Konto hat schon einen Spielstand – alte Kopie nie mehr übernehmen
      return;
    }

    const hochgeladen = await fetch('/api/spielstand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lokal),
    });
    if (hochgeladen.ok) legeBrowserKopieBeiseite();
  } catch (error) {
    console.error('Browser-Spielstand konnte nicht ins Konto übernommen werden:', error);
  }
}
