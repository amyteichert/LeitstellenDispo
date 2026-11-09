import { describe, expect, it } from 'vitest';
import { BESTENLISTE_CONFIG, ordneBestenliste, type BestenlisteWerte } from './bestenliste.js';

const werte = (teil: Partial<BestenlisteWerte>): BestenlisteWerte => ({ xp: 0, einsaetze: 0, perfekt: 0, ruf: 50, wachen: 1, fahrzeuge: 1, ...teil });
const spieler = (id: number, teil: Partial<BestenlisteWerte>) => ({ konto: { id }, werte: werte(teil) });

describe('Bestenliste', () => {
  it('sortiert nach dem Hauptwert und teilt Plätze bei Gleichstand', () => {
    const liste = ordneBestenliste([spieler(1, { xp: 100 }), spieler(2, { xp: 300 }), spieler(3, { xp: 100, einsaetze: 5 }), spieler(4, { xp: 50 })], 'xp');
    expect(liste.map((s) => [s.konto.id, s.platz])).toEqual([[2, 1], [3, 2], [1, 2], [4, 4]]);
  });

  it('lässt Spieler ohne Wert weg', () => {
    expect(ordneBestenliste([spieler(1, { xp: 0 }), spieler(2, { xp: 10 })], 'xp').map((s) => s.konto.id)).toEqual([2]);
  });

  it('zählt den Ruf erst ab genug Einsätzen, bei gleichem Ruf zählen mehr Einsätze', () => {
    const genug = BESTENLISTE_CONFIG.rufAbEinsaetzen;
    const liste = ordneBestenliste([
      spieler(1, { ruf: 100, einsaetze: genug - 1 }),
      spieler(2, { ruf: 90, einsaetze: genug }),
      spieler(3, { ruf: 90, einsaetze: genug + 10 }),
    ], 'ruf');
    expect(liste.map((s) => s.konto.id)).toEqual([3, 2]);
    expect(liste.map((s) => s.platz)).toEqual([1, 1]);
  });

  it('wertet den Fuhrpark nach Fahrzeugen, bei Gleichstand nach Wachen', () => {
    const liste = ordneBestenliste([spieler(1, { fahrzeuge: 5, wachen: 1 }), spieler(2, { fahrzeuge: 5, wachen: 3 })], 'fahrzeuge');
    expect(liste.map((s) => s.konto.id)).toEqual([2, 1]);
  });
});
