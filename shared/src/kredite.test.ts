import { describe, expect, it } from 'vitest';
import {
  KREDIT_AUSZAHLUNG_LABEL,
  berechneKredit,
  bucheKreditrate,
  erstelleKredit,
  getKreditBetraege,
  getKreditRahmen,
  istGueltigerKredit,
  pruefeKreditAbloesung,
  pruefeKreditAufnahme,
  rechneKreditrateAb,
} from './kredite.js';
import { RAENGE } from './laufbahn.js';
import { createNeuesSpiel, migriereSpielstand } from './spielstand.js';
import { pruefeGuthaben } from './plausibilitaet.js';

const MINUTE = 60_000;
const T0 = Date.UTC(2026, 10, 9, 10, 0, 0);

describe('Kredite', () => {
  it('Kreditrahmen wächst mit dem Rang', () => {
    expect(getKreditRahmen(0)).toBe(10_000);
    expect(getKreditRahmen(RAENGE[2].abXp)).toBe(50_000);
    expect(getKreditRahmen(RAENGE[6].abXp)).toBe(500_000);
    expect(getKreditBetraege(0)).toEqual([5_000, 10_000]);
  });

  it('berechnet Zinsen und Rate', () => {
    expect(berechneKredit(10_000, 4)).toEqual({ betrag: 10_000, zinsSatz: 0.05, laufzeitStunden: 4, gesamtSchuld: 10_500, rateJeStunde: 2_625 });
    expect(berechneKredit(10_000, 7)).toBeNull();
  });

  it('prüft die Aufnahme', () => {
    expect(pruefeKreditAufnahme(null, 10_000, 4, 0)).toBeNull();
    expect(pruefeKreditAufnahme(null, 25_000, 4, 0)).toContain('Rang');
    expect(pruefeKreditAufnahme(null, 12_345, 4, 0)).not.toBeNull();
    expect(pruefeKreditAufnahme(erstelleKredit(5_000, 4, T0), 5_000, 4, 0)).toContain('schon einen Kredit');
  });

  it('bucht Raten minütlich und ist danach erledigt', () => {
    // Erster Takt startet nur die Abrechnung
    const start = rechneKreditrateAb(erstelleKredit(10_000, 4, T0), T0);
    expect(start.betrag).toBe(0);

    // Minute für Minute (wie im Spiel), bis alles bezahlt ist
    let aktuell = start.kredit;
    let jetzt = T0;
    let gezahlt = 0;
    let nachEinerStunde = 0;
    while (aktuell) {
      jetzt += MINUTE;
      const schritt = rechneKreditrateAb(aktuell, jetzt);
      gezahlt += schritt.betrag;
      aktuell = schritt.kredit;
      if (jetzt === T0 + 60 * MINUTE) nachEinerStunde = gezahlt;
    }
    expect(nachEinerStunde).toBeGreaterThanOrEqual(2_600);
    expect(nachEinerStunde).toBeLessThanOrEqual(2_640);
    expect(gezahlt).toBe(10_500);
    expect(jetzt - T0).toBeLessThanOrEqual(4 * 60 * MINUTE + 5 * MINUTE);
  });

  it('zahlt nichts für die Zeit, in der das Spiel zu war', () => {
    const kredit = rechneKreditrateAb(erstelleKredit(10_000, 4, T0), T0).kredit!;
    const nachPause = rechneKreditrateAb(kredit, T0 + 5 * 60 * MINUTE);
    expect(nachPause.betrag).toBe(0);
    expect(nachPause.kredit?.restSchuld).toBe(10_500);
  });

  it('Ablösen nur mit genug Guthaben', () => {
    const kredit = erstelleKredit(10_000, 4, T0);
    expect(pruefeKreditAbloesung(kredit, 10_000)).not.toBeNull();
    expect(pruefeKreditAbloesung(kredit, 10_500)).toBeNull();
    expect(pruefeKreditAbloesung(null, 99_999)).not.toBeNull();
  });

  it('Raten werden je Stunde gesammelt gebucht', () => {
    let tx = bucheKreditrate([], 100, T0);
    tx = bucheKreditrate(tx, 50, T0 + 10 * MINUTE);
    expect(tx).toHaveLength(1);
    expect(tx[0].amount).toBe(150);
  });

  it('verwirft manipulierte Kredite beim Laden', () => {
    expect(istGueltigerKredit(erstelleKredit(10_000, 4, T0))).toBe(true);
    const boese = { ...erstelleKredit(10_000, 4, T0), restSchuld: -50_000 };
    expect(istGueltigerKredit(boese)).toBe(false);
    const geladen = migriereSpielstand({ ...createNeuesSpiel(new Date(T0)), kredit: boese });
    expect(geladen).not.toBeNull();
    expect(geladen!.kredit).toBeNull();
    const mitKredit = migriereSpielstand({ ...createNeuesSpiel(new Date(T0)), kredit: erstelleKredit(5_000, 12, T0) });
    expect(mitKredit!.kredit?.betrag).toBe(5_000);
  });

  it('Kreditauszahlung erhöht das Guthaben erklärbar, zählt aber nicht als Einnahme', () => {
    const alt = { balance: 1_000, transactions: [] };
    const neu = { balance: 11_000, transactions: [{ id: 'k', kind: 'Einnahme' as const, label: KREDIT_AUSZAHLUNG_LABEL, amount: 10_000, createdAt: '' }] };
    const pruefung = pruefeGuthaben(alt, neu);
    expect(pruefung.erlaubtesGuthaben).toBe(11_000);
    expect(pruefung.neueEinnahmen).toBe(0);
  });
});
