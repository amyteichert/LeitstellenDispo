// Ereignisse für den Discord-Bot (Großeinsätze, Serverfehler, Fehlermeldungen). Nur im Speicher:
// Der Bot fragt regelmäßig mit „seit“ nach; nach einem Neustart fängt die Nummerierung wieder bei 1 an.

export type EreignisArt = 'grosseinsatz' | 'fehler' | 'fehlermeldung';

export interface Ereignis {
  nr: number;
  art: EreignisArt;
  zeit: string;
  daten: Record<string, unknown>;
}

/** So viele Ereignisse werden aufgehoben – ältere fallen raus */
const MAX_EREIGNISSE = 200;

export function erstelleEreignisse() {
  const liste: Ereignis[] = [];
  let letzteNr = 0;
  const gestartet = new Date().toISOString();

  return {
    gestartet,
    melde(art: EreignisArt, daten: Record<string, unknown>) {
      liste.push({ nr: ++letzteNr, art, zeit: new Date().toISOString(), daten });
      if (liste.length > MAX_EREIGNISSE) liste.shift();
    },
    /** Alle Ereignisse nach Nummer `seit` */
    seit(seit: number) {
      return { ereignisse: liste.filter((e) => e.nr > seit), letzte: letzteNr, gestartet };
    },
  };
}

export type Ereignisse = ReturnType<typeof erstelleEreignisse>;
