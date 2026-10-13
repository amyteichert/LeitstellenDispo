import { useEffect, useRef, useState } from 'react';
import {
  createNeuesSpiel,
  haerteTest,
  migriereSpielstand,
  simulationsSchritt,
  starteSimulation,
  type BotAktion,
  type BotZiel,
  type HaerteTestErgebnis,
  type Problem,
  type SimulationLauf,
  type SimulationStatistik,
  type Spielstand,
} from '@leitstellendispo/shared';

/** Eigener Speicherplatz des Bots – getrennt vom Spielstand des Spielers. */
const BOT_STORAGE_KEY = 'leitstellendispo.bot-spielstand';
/** Reale Tick-Länge der Live-Schleife (ms). */
const TICK_MS = 200;
/** So viele Simulationsschritte je Tick – daraus ergibt sich die Geschwindigkeit. */
export const GESCHWINDIGKEITEN: Record<string, number> = {
  Echtzeit: 1,
  '10×': 10,
  '60×': 60,
  Turbo: 600,
};
const MAX_LOG = 200;

const ladeBotSpielstand = (): Spielstand | null => {
  try {
    const roh = localStorage.getItem(BOT_STORAGE_KEY);
    return roh ? migriereSpielstand(JSON.parse(roh)) : null;
  } catch {
    return null;
  }
};

const speichereBotSpielstand = (spielstand: Spielstand) => {
  try {
    localStorage.setItem(BOT_STORAGE_KEY, JSON.stringify(spielstand));
  } catch {
    // Speicher ist nur Komfort – ein voller/blockierter Speicher darf den Bot nicht stören
  }
};

/**
 * Steuert den Bot im Browser: eigener Spielstand, Start/Stopp, Geschwindigkeit, Ziel,
 * Live-Protokoll, Besitz-Dashboard und Fehlerwächter. Nutzt dieselbe Simulation wie der CLI-Bot.
 */
export function useBot() {
  const laufRef = useRef<SimulationLauf | null>(null);
  const problemeRef = useRef<Map<string, Problem>>(new Map());

  const [laeuft, setLaeuft] = useState(false);
  const [ziel, setZielState] = useState<BotZiel>('einsaetze');
  const [geschwindigkeit, setGeschwindigkeit] = useState<string>('10×');
  const [spielstand, setSpielstand] = useState<Spielstand>(() => ladeBotSpielstand() ?? createNeuesSpiel());
  const [log, setLog] = useState<BotAktion[]>([]);
  const [statistik, setStatistik] = useState<SimulationStatistik | null>(null);
  const [probleme, setProbleme] = useState<Problem[]>([]);
  const [haertetest, setHaertetest] = useState<HaerteTestErgebnis | null>(null);

  /** Erzeugt einen Lauf aus dem aktuellen Spielstand (oder setzt einen bestehenden fort). */
  const stelleLaufSicher = (): SimulationLauf => {
    if (!laufRef.current) {
      laufRef.current = starteSimulation({ ziel, start: spielstand, startZeit: Date.now(), seed: Date.now() & 0xffff });
    }
    return laufRef.current;
  };

  // Live-Schleife: advanced die Simulation, solange der Bot läuft
  useEffect(() => {
    if (!laeuft) return;
    const schritteProTick = GESCHWINDIGKEITEN[geschwindigkeit] ?? 10;
    const intervall = setInterval(() => {
      const lauf = stelleLaufSicher();
      const neueAktionen: BotAktion[] = [];
      for (let i = 0; i < schritteProTick; i += 1) {
        const schritt = simulationsSchritt(lauf);
        neueAktionen.push(...schritt.neueAktionen);
        for (const problem of schritt.neueProbleme) {
          problemeRef.current.set(`${problem.code}|${problem.text}`, problem);
        }
      }
      setSpielstand(lauf.spielstand);
      setStatistik({ ...lauf.statistik });
      if (neueAktionen.length > 0) {
        setLog((current) => [...neueAktionen.reverse(), ...current].slice(0, MAX_LOG));
      }
      if (problemeRef.current.size > 0) setProbleme([...problemeRef.current.values()]);
    }, TICK_MS);
    return () => clearInterval(intervall);
  }, [laeuft, geschwindigkeit]);

  const start = () => setLaeuft(true);

  const stopp = () => {
    setLaeuft(false);
    if (laufRef.current) speichereBotSpielstand(laufRef.current.spielstand);
  };

  const zuruecksetzen = () => {
    setLaeuft(false);
    laufRef.current = null;
    problemeRef.current = new Map();
    const neu = createNeuesSpiel();
    setSpielstand(neu);
    setLog([]);
    setStatistik(null);
    setProbleme([]);
    try { localStorage.removeItem(BOT_STORAGE_KEY); } catch { /* egal */ }
  };

  /** Ziel wechseln – wirkt sofort, auch während der Bot läuft. */
  const setZiel = (neuesZiel: BotZiel) => {
    setZielState(neuesZiel);
    if (laufRef.current) laufRef.current.ziel = neuesZiel;
  };

  /** Startet den Robustheits-/Härtetest (synchron, wenige Millisekunden). */
  const starteHaertetest = (versuche = 2000) => {
    setHaertetest(haerteTest({ seed: Date.now() & 0xffff, versuche }));
  };

  // Beim Verlassen der Seite den Fortschritt sichern
  useEffect(() => {
    const sichern = () => { if (laufRef.current) speichereBotSpielstand(laufRef.current.spielstand); };
    window.addEventListener('beforeunload', sichern);
    return () => window.removeEventListener('beforeunload', sichern);
  }, []);

  return {
    laeuft,
    ziel,
    geschwindigkeit,
    spielstand,
    log,
    statistik,
    probleme,
    haertetest,
    start,
    stopp,
    zuruecksetzen,
    setZiel,
    setGeschwindigkeit,
    starteHaertetest,
  };
}
