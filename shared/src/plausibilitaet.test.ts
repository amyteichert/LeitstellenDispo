import { describe, expect, it } from 'vitest';
import { PLAUSIBILITAET, begrenzeStartbuchung, einnahmenAuffaellig, erlaubteKreditAuszahlung, pruefeGuthaben, pruefeLaufbahn } from './plausibilitaet.js';
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

describe('pruefeGuthaben mit Regeln des Servers', () => {
  it('zählt unbestätigte Server-, Dev- und Kredit-Gutschriften nicht als Erklärung und nennt ihre IDs', () => {
    const neu = { balance: 20_000 + 3_000 + 7_000 + 9_000, transactions: [
      tx('s', 'Einnahme', 3_000, 'Schichtzulage – Tag 3 in Folge'), tx('d', 'Einnahme', 7_000, 'Dev-Werkzeug: Guthaben angepasst'),
      tx('k', 'Einnahme', 9_000, 'Kredit ausgezahlt'), ...alt.transactions] };
    const ergebnis = pruefeGuthaben(alt, neu, { serverGutschriftenMax: 1_000, devWerkzeuge: false, kreditAuszahlungMax: 0 });
    expect(ergebnis).toMatchObject({ nichtGedeckt: 19_000, erlaubtesGuthaben: 20_000 });
    expect(ergebnis.ungedeckteIds.sort()).toEqual(['d', 'k', 's']);
    // Gedeckt: alles bleibt
    expect(pruefeGuthaben(alt, neu, { serverGutschriftenMax: 3_000, devWerkzeuge: true, kreditAuszahlungMax: 9_000 }))
      .toMatchObject({ nichtGedeckt: 0, erlaubtesGuthaben: neu.balance, ungedeckteIds: [] });
  });

  it('begrenzt die Startbuchung auf das echte Startguthaben', () => {
    const [start] = begrenzeStartbuchung([{ ...tx('initial-balance', 'Einnahme', 5_000_000), id: 'initial-balance' }]);
    expect(start.amount).toBe(20_000);
  });

  it('erlaubt eine Kreditauszahlung nur mit neuem Kredit oder Ablösung', () => {
    const kredit = { id: 'k1', betrag: 25_000 };
    expect(erlaubteKreditAuszahlung(null, { kredit, transactions: [] })).toBe(25_000);
    expect(erlaubteKreditAuszahlung({ kredit }, { kredit, transactions: [] })).toBe(0);
    expect(erlaubteKreditAuszahlung({ kredit: null }, { kredit: null, transactions: [tx('a', 'Ausgabe', 26_250, 'Kredit abgelöst')] })).toBeGreaterThan(0);
  });
});

describe('pruefeLaufbahn', () => {
  const lb = (xp: number, einsaetze: number, perfekt = 0) => ({ xp, einsaetze, perfekt, erfolge: [] });

  it('lässt realistischen Zuwachs unverändert', () => {
    const neu = lb(30_000, 500, 200);
    expect(pruefeLaufbahn(lb(0, 0), neu, 3_600_000)).toEqual({ laufbahn: neu, gekappt: false });
  });

  it('kappt unmöglichen Zuwachs auf das Erreichbare', () => {
    const { laufbahn, gekappt } = pruefeLaufbahn(lb(100, 1), lb(999_999_999, 1_000_000, 1_000_000), 60_000);
    expect(gekappt).toBe(true);
    const einsaetzeMax = PLAUSIBILITAET.einsaetzeSockel + PLAUSIBILITAET.einsaetzeProStundeMax / 60;
    expect(laufbahn.einsaetze).toBe(Math.floor(1 + einsaetzeMax));
    expect(laufbahn.perfekt).toBeLessThanOrEqual(laufbahn.einsaetze);
    expect(laufbahn.xp).toBe(Math.floor(100 + PLAUSIBILITAET.xpSockel + PLAUSIBILITAET.xpJeEinsatzMax * einsaetzeMax));
  });

  it('lässt weniger als vorher stehen (z. B. neues Spiel)', () => {
    expect(pruefeLaufbahn(lb(5_000, 100), lb(0, 0), 0).gekappt).toBe(false);
  });
});
