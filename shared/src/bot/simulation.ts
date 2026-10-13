/**
 * Simulation: spielt das echte Spiel (v5) im Zeitraffer durch – ohne Browser.
 *
 * Mirror der Client-Schleifen: Einsatzerzeugung, Spiel-Tick, Einnahmen (Grundgeld + Ruf-Bonus),
 * laufende Kosten – plus die Bot-Entscheidungen. Aufgebaut als Einzelschritt, damit CLI/Panel
 * denselben Code nutzen.
 *
 * Vereinfachungen (Sandbox): Ruf verändert sich nur über die Einsatzabrechnung; Zufriedenheit,
 * Bewerber, Kündigungen, Ausbildung und Funk werden nicht simuliert.
 */
import { GAME_CONFIG } from '../konfig.js';
import { maxOffeneEinsaetze } from '../aufkommen.js';
import { RUF_CONFIG, rechneEinsaetzeAb } from '../bewertung.js';
import { getLaufendeKosten, rechneLaufendeKostenAb, LAUFENDE_KOSTEN_LABEL } from '../kosten.js';
import { createNeuesSpiel, type Spielstand } from '../spielstand.js';
import { berechneSpielTick } from '../spielTick.js';
import { erzeugeZufallsEinsatz } from '../einsatzErzeugung.js';
import { formatEinsatzTitel } from '../daten.js';
import { erzeugeZufall, type Zufall } from './zufall.js';
import { botSchritt, type BotAktion, type BotZiel } from './bot.js';
import { pruefeSpielstand, type Problem } from './fehlerwaechter.js';

export interface SimulationOptionen {
  ziel: BotZiel;
  dauerMs?: number;
  start?: Spielstand;
  schrittMs?: number;
  botIntervallMs?: number;
  seed?: number;
  startZeit?: number;
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
  ruf: number;
}

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
  kostenAbgerechnetBis: number;
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
  probleme: Problem[];
}

const stationenZahl = (spielstand: Spielstand) => spielstand.locations.filter((location) => location.type === 'station').length;

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
    kostenAbgerechnetBis: startZeit,
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
      wachen: stationenZahl(spielstand),
      ruf: spielstand.ruf ?? RUF_CONFIG.start,
    },
  };
}

export function simulationsSchritt(lauf: SimulationLauf): SchrittErgebnis {
  const jetzt = lauf.jetzt;
  const neueAktionen: BotAktion[] = [];
  const neueProbleme: Problem[] = [];
  const stat = lauf.statistik;
  stat.schritte += 1;

  // 1. Neue Einsätze (nur mit Wache; Intervall + Obergrenze abhängig von der Wachenzahl)
  const wachen = stationenZahl(lauf.spielstand);
  const offen = lauf.spielstand.incidents.filter((incident) => incident.status !== 'abgeschlossen').length;
  if (wachen > 0 && jetzt - lauf.letzteErzeugung >= GAME_CONFIG.incidentGenerationMs && offen < maxOffeneEinsaetze(wachen)) {
    lauf.letzteErzeugung = jetzt;
    const ergebnis = erzeugeZufallsEinsatz(lauf.spielstand.locations, lauf.spielstand.vehicles, jetzt, undefined, lauf.spielstand.krankenhaeuser);
    if ('einsatz' in ergebnis) {
      lauf.spielstand = { ...lauf.spielstand, incidents: [ergebnis.einsatz, ...lauf.spielstand.incidents] };
      stat.einsaetzeErzeugt += 1;
    }
  }

  // 2. Spiel-Tick
  const tick = berechneSpielTick(
    { vehicles: lauf.spielstand.vehicles, incidents: lauf.spielstand.incidents, locations: lauf.spielstand.locations, krankenhaeuser: lauf.spielstand.krankenhaeuser },
    jetzt,
  );
  if (tick.geaendert) {
    let { balance, transactions } = lauf.spielstand;
    let ruf = lauf.spielstand.ruf ?? RUF_CONFIG.start;
    let completed = lauf.spielstand.completedIncidentHistory;
    if (tick.abgeschlossen.length > 0) {
      const abrechnung = rechneEinsaetzeAb(tick.abgeschlossen, ruf);
      ruf = abrechnung.ruf;
      for (const incident of abrechnung.einsaetze) {
        const bonus = incident.bewertung?.bonus ?? 0;
        balance += incident.reward + bonus;
        stat.einnahmen += incident.reward + bonus;
        transactions = [{
          id: `txn-${jetzt}-${stat.einsaetzeAbgeschlossen}`,
          kind: 'Einnahme' as const,
          label: `${incident.organization} – ${formatEinsatzTitel(incident)} abgeschlossen`,
          amount: incident.reward,
          createdAt: new Date(jetzt).toISOString(),
        }, ...transactions];
        stat.einsaetzeAbgeschlossen += 1;
      }
      completed = [...[...abrechnung.einsaetze].reverse(), ...completed].slice(0, GAME_CONFIG.completedIncidentHistoryLimit);
    }
    stat.einsaetzeVerfallen += tick.verfallen.length;
    lauf.spielstand = {
      ...lauf.spielstand,
      vehicles: tick.vehicles,
      incidents: tick.incidents,
      krankenhaeuser: tick.krankenhaeuser ?? lauf.spielstand.krankenhaeuser,
      completedIncidentHistory: completed,
      balance,
      transactions,
      ruf,
    };
  }

  // 3. Laufende Kosten (minütlich)
  const kostenJeStunde = getLaufendeKosten({
    locations: lauf.spielstand.locations,
    vehicles: lauf.spielstand.vehicles,
    personal: lauf.spielstand.personal ?? [],
    krankenhaeuser: lauf.spielstand.krankenhaeuser,
  }).gesamt;
  const kosten = rechneLaufendeKostenAb(kostenJeStunde, lauf.kostenAbgerechnetBis, jetzt);
  lauf.kostenAbgerechnetBis = kosten.abgerechnetBis;
  if (kosten.betrag > 0) {
    lauf.spielstand = {
      ...lauf.spielstand,
      balance: lauf.spielstand.balance - kosten.betrag,
      transactions: [
        { id: `kosten-${jetzt}`, kind: 'Ausgabe', label: LAUFENDE_KOSTEN_LABEL, amount: kosten.betrag, createdAt: new Date(jetzt).toISOString() },
        ...lauf.spielstand.transactions,
      ],
    };
  }

  // 4. Bot-Entscheidung
  if (jetzt - lauf.letzterBot >= lauf.botIntervallMs) {
    lauf.letzterBot = jetzt;
    const ergebnis = botSchritt(lauf.spielstand, lauf.ziel, jetzt, lauf.zufall);
    lauf.spielstand = ergebnis.spielstand;
    neueAktionen.push(...ergebnis.aktionen);
  }

  // 5. Fehlerwächter
  if (lauf.pruefen) neueProbleme.push(...pruefeSpielstand(lauf.spielstand, jetzt));

  stat.endGuthaben = lauf.spielstand.balance;
  stat.fahrzeuge = lauf.spielstand.vehicles.length;
  stat.wachen = stationenZahl(lauf.spielstand);
  stat.ruf = lauf.spielstand.ruf ?? RUF_CONFIG.start;
  stat.ausgaben = lauf.spielstand.transactions.filter((t) => t.kind === 'Ausgabe').reduce((s, t) => s + t.amount, 0);

  lauf.jetzt += lauf.schrittMs;
  stat.simulierteDauerMs = stat.schritte * lauf.schrittMs;
  return { neueAktionen, neueProbleme };
}

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
  return { spielstand: lauf.spielstand, log, probleme: [...problemeNachCode.values()], statistik: lauf.statistik };
}
