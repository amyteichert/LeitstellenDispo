import { describe, expect, it } from 'vitest';
import { einnahmenAuffaellig, pruefeGuthaben } from './plausibilitaet.js';
import type { FinanceTransaction } from './typen.js';

const tx = (id: string, kind: FinanceTransaction['kind'], amount: number, label = 'Einsatz abgeschlossen'): FinanceTransaction =>
  ({ id, kind, amount, label, createdAt: '2026-10-17T12:00:00Z' });

const alt = { balance: 20_000, transactions: [tx('start', 'Einnahme', 20_000, 'Startguthaben')] };

describe('pruefeGuthaben', () => {
  it('lässt ehrliches Spielen unverändert', () => {
    const neu = { balance: 20_300, transactions: [tx('e1', 'Einnahme', 500), tx('k1', 'Ausgabe', 200, 'Kauf'), ...alt.transactions] };
    expect(pruefeGuthaben(alt, neu)).toMatchObject({ unerklaert: 0, erlaubtesGuthaben: 20_300, neueEinnahmen: 500 });
  });

  it('kürzt ein ohne Buchung erhöhtes Guthaben', () => {
    const neu = { balance: 455_000, transactions: [tx('e1', 'Einnahme', 500), ...alt.transactions] };
    expect(pruefeGuthaben(alt, neu)).toMatchObject({ unerklaert: 434_500, erlaubtesGuthaben: 20_500 });
  });

  it('zählt geänderte Buchungen (laufende Kosten werden stündlich aufaddiert) nur mit der Differenz', () => {
    const vorher = { balance: 19_900, transactions: [tx('lk', 'Ausgabe', 100, 'Laufende Kosten'), ...alt.transactions] };
    const nachher = { balance: 19_850, transactions: [tx('lk', 'Ausgabe', 150, 'Laufende Kosten'), ...alt.transactions] };
    expect(pruefeGuthaben(vorher, nachher)).toMatchObject({ erklaert: -50, unerklaert: 0, erlaubtesGuthaben: 19_850 });
  });

  it('zählt Schichtzulage und Team-Korrekturen nicht zu den Einnahmen aus dem Spiel', () => {
    const neu = { balance: 26_000, transactions: [tx('s', 'Einnahme', 1_000, 'Schichtzulage – Tag 1 in Folge'), tx('t', 'Einnahme', 5_000, 'Korrektur durch das Team – Bug'), ...alt.transactions] };
    expect(pruefeGuthaben(alt, neu)).toMatchObject({ unerklaert: 0, neueEinnahmen: 0 });
  });

  it('lässt weniger Guthaben als erklärt stehen', () => {
    const neu = { balance: 19_000, transactions: alt.transactions };
    expect(pruefeGuthaben(alt, neu).erlaubtesGuthaben).toBe(19_000);
  });
});

describe('einnahmenAuffaellig', () => {
  it('ist großzügig bei normalem Spiel und schlägt bei erfundenen Millionen an', () => {
    expect(einnahmenAuffaellig(30_000, 60_000)).toBe(false);
    expect(einnahmenAuffaellig(400_000, 3_600_000)).toBe(false);
    expect(einnahmenAuffaellig(5_000_000, 60_000)).toBe(true);
  });
});
