/**
 * Simulation: spielt das Spiel im Zeitraffer durch – ganz ohne Browser.
 *
 * Mirror der Client-Schleifen (Einsatzerzeugung, Spiel-Tick, Belohnung) plus die
 * Bot-Entscheidungen. Aufgebaut als Einzelschritt (`simulationsSchritt`), damit sowohl
 * der CLI-Bot (Schleife über alle Schritte) als auch das Bot-Panel im Client
 * (ein Schritt je Frame, live) denselben Code nutzen.
 *
 * Hinweis: Die Einsatzerzeugung nutzt intern `Math.random`; der Seed steuert nur
 * die Bot-/Chaos-/Bau-Entscheidungen. Für die Fehlerjagd reicht das.
 */
import { GAME_CONFIG } from '../konfig.js';
import { createNeuesSpiel, type Spielstand } from '../spielstand.js';
import { berechneSpielTick } from '../spielTick.js';
import { erzeugeZufallsEinsatz } from '../einsatzErzeugung.js';
import { formatEinsatzTitel } from '../daten.js';
import { erzeugeZufall, type Zufall } from '../zufall.js';
import { botSchritt, type BotAktion, type BotZiel } from './bot.js';
import { pruefeSpielstand, type Problem } from './fehlerwaechter.js';

export interface SimulationOptionen {
  ziel: BotZiel;
  /** Simulierte Dauer in Millisekunden (Spielzeit) – nur für den Komplettlauf `simuliere`. */
  dauerMs?: number;
  /** Ausgangszustand (Standard: neues Spiel). */
  start?: Spielstand;
  /** Schrittweite der Spielzeit je Iteration (Standard 1000 ms). */
  schrittMs?: number;
  /** Abstand zwischen Bot-Entscheidungen (Standard 3000 ms Spielzeit). */
  botIntervallMs?: number;
  /** Startwert für den Zufallsgenerator (reproduzierbare Läufe). */
  seed?: number;
  /** Start-Zeitstempel der Spielzeit. */
  startZeit?: number;
  /** Fehlerwächter nach jedem Tick laufen lassen (Standard true). */
  pruefeInvarianten?: boolean;
}

export interface SimulationStatistik {
  simulierteDauerMs: number;
  schritte: number;
  einsaetzeErzeugt: number;
  einsaetzeAbgeschlossen: number;
  einsaetzeVerfallen: number;
  einnahmen: number;
  ausgaben: number;
  startGuthaben: number;
  endGuthaben: number;
  fahrzeuge: number;
  wachen: number;
}

/** Laufender Zustand einer Simulation – kann Schritt für Schritt fortgesetzt werden. */
export interface SimulationLauf {
  ziel: BotZiel;
  spielstand: Spielstand;
  jetzt: number;
  schrittMs: number;
  botIntervallMs: number;
  pruefen: boolean;
  zufall: Zufall;
  letzteErzeugung: number;
  letzterBot: number;
  statistik: SimulationStatistik;
}

export interface SchrittErgebnis {
  neueAktionen: BotAktion[];
  neueProbleme: Problem[];
}

export interface SimulationErgebnis {
  spielstand: Spielstand;
  log: BotAktion[];
  statistik: SimulationStatistik;
  /** Eindeutige Probleme, die der Fehlerwächter während des Laufs gefunden hat. */
  probleme: Problem[];
}

/** Startet einen fortsetzbaren Simulationslauf. */
export function starteSimulation(optionen: SimulationOptionen): SimulationLauf {
  const startZeit = optionen.startZeit ?? 1_700_000_000_000;
  const spielstand = optionen.start ?? createNeuesSpiel(new Date(startZeit));
  return {
    ziel: optionen.ziel,
    spielstand,
    jetzt: startZeit,
    schrittMs: optionen.schrittMs ?? 1000,
    botIntervallMs: optionen.botIntervallMs ?? 3000,
    pruefen: optionen.pruefeInvarianten ?? true,
    zufall: erzeugeZufall(optionen.seed ?? 1),
    letzteErzeugung: startZeit,
    letzterBot: startZeit,
    statistik: {
      simulierteDauerMs: 0,
      schritte: 0,
      einsaetzeErzeugt: 0,
      einsaetzeAbgeschlossen: 0,
      einsaetzeVerfallen: 0,
      einnahmen: 0,
      ausgaben: 0,
      startGuthaben: spielstand.balance,
      endGuthaben: spielstand.balance,
      fahrzeuge: spielstand.vehicles.length,
      wachen: spielstand.locations.filter((location) => location.type === 'station').length,
    },
  };
}

/**
 * Führt genau einen Simulationsschritt aus und verändert den Lauf in place
 * (Statistik, Spielstand, Zeit). Liefert die in diesem Schritt entstandenen
 * Bot-Aktionen und gefundenen Probleme zurück.
 */
export function simulationsSchritt(lauf: SimulationLauf): SchrittErgebnis {
  const jetzt = lauf.jetzt;
  const neueAktionen: BotAktion[] = [];
  const neueProbleme: Problem[] = [];
  const stat = lauf.statistik;
  stat.schritte += 1;

  // 1. Neue Einsätze (wie im Client: Intervall + Obergrenze offener Einsätze)
  const offen = lauf.spielstand.incidents.filter((incident) => incident.status !== 'abgeschlossen').length;
  if (jetzt - lauf.letzteErzeugung >= GAME_CONFIG.incidentGenerationMs && offen < GAME_CONFIG.maxOpenIncidents) {
    lauf.letzteErzeugung = jetzt;
    const ergebnis = erzeugeZufallsEinsatz(lauf.spielstand.locations, lauf.spielstand.vehicles, jetzt);
    if ('einsatz' in ergebnis) {
      lauf.spielstand = { ...lauf.spielstand, incidents: [ergebnis.einsatz, ...lauf.spielstand.incidents] };
      stat.einsaetzeErzeugt += 1;
    }
  }

  // 2. Spiel-Tick (Ankunft, Bearbeitung, Transport, Abschluss, Rückfahrt)
  const tick = berechneSpielTick(
    { vehicles: lauf.spielstand.vehicles, incidents: lauf.spielstand.incidents, locations: lauf.spielstand.locations, krankenhaeuser: lauf.spielstand.krankenhaeuser },
    jetzt,
  );
  if (tick.geaendert) {
    let transactions = lauf.spielstand.transactions;
    let balance = lauf.spielstand.balance;
    for (const incident of tick.abgeschlossen) {
      balance += incident.reward;
      stat.einnahmen += incident.reward;
      transactions = [{
        id: `txn-${jetzt}-${stat.einsaetzeAbgeschlossen}`,
        kind: 'Einnahme' as const,
        label: `${incident.organization} – ${formatEinsatzTitel(incident)} abgeschlossen`,
        amount: incident.reward,
        createdAt: new Date(jetzt).toISOString(),
      }, ...transactions];
      stat.einsaetzeAbgeschlossen += 1;
    }
    stat.einsaetzeVerfallen += tick.verfallen.length;
    lauf.spielstand = {
      ...lauf.spielstand,
      vehicles: tick.vehicles,
      incidents: tick.incidents,
      completedIncidentHistory: [...tick.abgeschlossen, ...lauf.spielstand.completedIncidentHistory].slice(0, GAME_CONFIG.completedIncidentHistoryLimit),
      balance,
      transactions,
    };
  }

  // 3. Bot-Entscheidung
  if (jetzt - lauf.letzterBot >= lauf.botIntervallMs) {
    lauf.letzterBot = jetzt;
    const ergebnis = botSchritt(lauf.spielstand, lauf.ziel, jetzt, lauf.zufall);
    lauf.spielstand = ergebnis.spielstand;
    neueAktionen.push(...ergebnis.aktionen);
  }

  // 4. Fehlerwächter
  if (lauf.pruefen) {
    neueProbleme.push(...pruefeSpielstand(lauf.spielstand, jetzt));
  }

  // Statistik aktualisieren
  stat.endGuthaben = lauf.spielstand.balance;
  stat.fahrzeuge = lauf.spielstand.vehicles.length;
  stat.wachen = lauf.spielstand.locations.filter((location) => location.type === 'station').length;
  stat.ausgaben = lauf.spielstand.transactions
    .filter((transaction) => transaction.kind === 'Ausgabe')
    .reduce((summe, transaction) => summe + transaction.amount, 0);

  lauf.jetzt += lauf.schrittMs;
  stat.simulierteDauerMs = stat.schritte * lauf.schrittMs;
  return { neueAktionen, neueProbleme };
}

/** Spielt eine komplette Simulation durch und liefert Endzustand, Protokoll, Statistik und gefundene Probleme. */
export function simuliere(optionen: SimulationOptionen): SimulationErgebnis {
  const dauerMs = optionen.dauerMs ?? 0;
  const lauf = starteSimulation(optionen);
  const startZeit = lauf.jetzt;
  const log: BotAktion[] = [];
  const problemeNachCode = new Map<string, Problem>();

  while (lauf.jetzt <= startZeit + dauerMs) {
    const schritt = simulationsSchritt(lauf);
    log.push(...schritt.neueAktionen);
    for (const problem of schritt.neueProbleme) {
      const schluessel = `${problem.code}|${problem.text}`;
      if (!problemeNachCode.has(schluessel)) problemeNachCode.set(schluessel, problem);
    }
  }

  lauf.statistik.simulierteDauerMs = dauerMs;
  return {
    spielstand: lauf.spielstand,
    log,
    probleme: [...problemeNachCode.values()],
    statistik: lauf.statistik,
  };
}
