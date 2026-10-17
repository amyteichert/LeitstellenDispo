import { describe, expect, it } from 'vitest';
import { simuliere, simulationsSchritt, starteSimulation } from './simulation.js';
import { BOT_MAX_WARTEZEIT_MS } from './bot.js';
import { getWarteLage } from '../alarmierung.js';
import { pruefeSpielstand, nurFehler } from './fehlerwaechter.js';
import { haerteTest } from './chaos.js';
import { createNeuesSpiel } from '../spielstand.js';

describe('Simulation (v5)', () => {
  it('baut zuerst eine Wache, arbeitet Einsätze ab und verletzt keine Invariante', () => {
    const ergebnis = simuliere({ ziel: 'einsaetze', dauerMs: 4 * 60 * 60 * 1000, seed: 7 });
    expect(ergebnis.statistik.wachen).toBeGreaterThanOrEqual(1);
    expect(ergebnis.statistik.einsaetzeErzeugt).toBeGreaterThan(0);
    expect(ergebnis.statistik.einsaetzeAbgeschlossen).toBeGreaterThan(0);
    expect(Number.isFinite(ergebnis.spielstand.balance)).toBe(true);
    expect(nurFehler(ergebnis.probleme)).toHaveLength(0);
  });

  it('baut beim Ziel „ausbauen“ mit genug Geld mehrere Wachen', () => {
    // Mit Startkapital (die frühe RD-Phase ist sonst defizitär – siehe Balancing-Hinweis)
    const start = { ...createNeuesSpiel(), balance: 300_000 };
    const ergebnis = simuliere({ ziel: 'ausbauen', dauerMs: 6 * 60 * 60 * 1000, seed: 3, start });
    expect(ergebnis.statistik.wachen).toBeGreaterThanOrEqual(2);
  });

  it('überlebt das Chaos-Ziel ohne Invariantenbruch', () => {
    const ergebnis = simuliere({ ziel: 'chaos', dauerMs: 3 * 60 * 60 * 1000, seed: 9 });
    expect(nurFehler(ergebnis.probleme)).toHaveLength(0);
  });

  it('blockiert sich nicht selbst und rutscht nicht ins Minus', () => {
    // Früher: zwei „2× RTW“-Einsätze mit je einem RTW blockierten sich für immer – nur noch Kosten, keine Einnahmen
    for (const seed of [1, 7]) {
      const lauf = starteSimulation({ ziel: 'einsaetze', seed });
      let tiefsterStand = Infinity;
      while (lauf.statistik.simulierteDauerMs < 8 * 60 * 60 * 1000) {
        simulationsSchritt(lauf);
        tiefsterStand = Math.min(tiefsterStand, lauf.spielstand.balance);
      }
      expect(tiefsterStand).toBeGreaterThan(0);
      // Kein Fahrzeug wartet länger als die erlaubte Wartezeit (+ Bot-Intervall) vor Ort auf fehlende Kräfte
      const zustand = { incidents: lauf.spielstand.incidents, vehicles: lauf.spielstand.vehicles, locations: lauf.spielstand.locations };
      const festgefahren = lauf.spielstand.incidents
        .map((incident) => getWarteLage(incident, zustand, lauf.jetzt))
        .filter((lage) => lage && lage.fehlt.length > 0
          && lage.wartende.some((w) => w.wartetSeit < lauf.jetzt - BOT_MAX_WARTEZEIT_MS - lauf.botIntervallMs));
      expect(festgefahren).toHaveLength(0);
    }
  }, 60_000);

  it('läuft 24 h stabil durch', () => {
    const ergebnis = simuliere({ ziel: 'schnell', dauerMs: 24 * 60 * 60 * 1000, seed: 11, botIntervallMs: 5000 });
    expect(nurFehler(ergebnis.probleme)).toHaveLength(0);
    expect(Number.isFinite(ergebnis.spielstand.balance)).toBe(true);
    // Der Bot spielt jetzt tausende Einsätze statt sich nach kurzer Zeit festzufahren – das dauert ein paar Sekunden
  }, 60_000);
});

describe('Fehlerwächter', () => {
  it('erkennt einen NaN-Kontostand', () => {
    expect(pruefeSpielstand({ ...createNeuesSpiel(), balance: NaN }).some((p) => p.code === 'balance-nan')).toBe(true);
  });
});

describe('Härtetest', () => {
  it('bringt keine der Spielfunktionen mit Mülldaten zum Absturz', () => {
    const ergebnis = haerteTest({ seed: 1, versuche: 800 });
    expect(ergebnis.abstuerze).toEqual([]);
  });
});
