import { describe, expect, it } from 'vitest';
import { simuliere } from './simulation.js';
import { pruefeSpielstand, nurFehler } from './fehlerwaechter.js';
import { haerteTest } from './chaos.js';
import { createNeuesSpiel } from '../spielstand.js';

describe('Simulation', () => {
  it('spielt ein paar Stunden durch, schließt Einsätze ab und verletzt keine Invariante', () => {
    const ergebnis = simuliere({ ziel: 'einsaetze', dauerMs: 3 * 60 * 60 * 1000, seed: 7 });
    expect(ergebnis.statistik.einsaetzeErzeugt).toBeGreaterThan(0);
    expect(ergebnis.statistik.einsaetzeAbgeschlossen).toBeGreaterThan(0);
    expect(Number.isFinite(ergebnis.spielstand.balance)).toBe(true);
    expect(nurFehler(ergebnis.probleme)).toHaveLength(0);
  });

  it('baut beim Ziel „ausbauen“ zusätzliche Wachen', () => {
    const ergebnis = simuliere({ ziel: 'ausbauen', dauerMs: 6 * 60 * 60 * 1000, seed: 3 });
    expect(ergebnis.statistik.wachen).toBeGreaterThanOrEqual(2);
  });

  it('überlebt das Chaos-Ziel ohne Invariantenbruch', () => {
    const ergebnis = simuliere({ ziel: 'chaos', dauerMs: 3 * 60 * 60 * 1000, seed: 9 });
    expect(nurFehler(ergebnis.probleme)).toHaveLength(0);
  });

  it('läuft über viele Stunden ohne Fehler durch (Dauerlauf)', () => {
    const ergebnis = simuliere({ ziel: 'schnell', dauerMs: 24 * 60 * 60 * 1000, seed: 11, botIntervallMs: 5000 });
    expect(nurFehler(ergebnis.probleme)).toHaveLength(0);
    expect(Number.isFinite(ergebnis.spielstand.balance)).toBe(true);
  });
});

describe('Zufallsgenerator', () => {
  it('liefert bei gleichem Seed dieselbe Zahlenfolge', async () => {
    const { erzeugeZufall } = await import('../zufall.js');
    const a = erzeugeZufall(42);
    const b = erzeugeZufall(42);
    const folgeA = Array.from({ length: 5 }, () => a());
    const folgeB = Array.from({ length: 5 }, () => b());
    expect(folgeA).toEqual(folgeB);
  });
});

describe('Fehlerwächter', () => {
  it('erkennt einen NaN-Kontostand', () => {
    const stand = { ...createNeuesSpiel(), balance: NaN };
    expect(pruefeSpielstand(stand).some((problem) => problem.code === 'balance-nan')).toBe(true);
  });

  it('erkennt ein Fahrzeug in zwei laufenden Einsätzen', () => {
    const start = createNeuesSpiel();
    const vehicleId = start.vehicles[0].id;
    const alarmiert = (id: string) => ({
      id, stichwort: 'RD 1', meldebild: 'Test', organization: 'Rettungsdienst' as const,
      status: 'alarmiert' as const, coords: [48.7, 9.1] as [number, number], address: '', generatedByStationId: 's',
      generatedByStationName: 's', requiredVehicles: [], reward: 0, durationSeconds: 60, createdAt: Date.now(), vorlageId: 'x',
      meldungen: [], alarmedVehicles: [{ vehicleId, distanceKm: 1, etaSeconds: 60, arrivalAt: Date.now() + 60000 }],
    });
    const stand = { ...start, incidents: [alarmiert('a'), alarmiert('b')] };
    expect(pruefeSpielstand(stand).some((problem) => problem.code === 'fahrzeug-doppelt-alarmiert')).toBe(true);
  });
});

describe('Härtetest', () => {
  it('bringt keine der Spielfunktionen mit Mülldaten zum Absturz', () => {
    const ergebnis = haerteTest({ seed: 1, versuche: 800 });
    expect(ergebnis.abstuerze).toEqual([]);
  });
});
