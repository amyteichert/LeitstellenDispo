import { describe, expect, it } from 'vitest';
import { simuliere } from './simulation.js';
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

  it('läuft 24 h stabil durch', () => {
    const ergebnis = simuliere({ ziel: 'schnell', dauerMs: 24 * 60 * 60 * 1000, seed: 11, botIntervallMs: 5000 });
    expect(nurFehler(ergebnis.probleme)).toHaveLength(0);
    expect(Number.isFinite(ergebnis.spielstand.balance)).toBe(true);
  });
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
