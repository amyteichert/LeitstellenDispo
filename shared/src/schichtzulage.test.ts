import { describe, expect, it } from 'vitest';
import { deutscherTag, naechsteSerie, schichtzulageBetrag, vortag } from './schichtzulage.js';

describe('schichtzulageBetrag', () => {
  it('steigt von 1.000 € in 500er-Schritten bis 4.000 €', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 13].map(schichtzulageBetrag)).toEqual([1000, 1500, 2000, 2500, 3000, 3500, 4000, 4000, 4000]);
  });

  it('zahlt an jedem 14. Tag in Folge den Sonderbetrag', () => {
    expect(schichtzulageBetrag(14)).toBe(15_000);
    expect(schichtzulageBetrag(15)).toBe(4000);
    expect(schichtzulageBetrag(28)).toBe(15_000);
  });
});

describe('Tageswechsel', () => {
  it('wechselt um Mitternacht deutscher Zeit, nicht UTC', () => {
    // 22:30 UTC im Sommer = 00:30 in Berlin – schon der nächste Tag
    expect(deutscherTag(Date.UTC(2026, 9, 17, 22, 30))).toBe('2026-10-18');
    expect(deutscherTag(Date.UTC(2026, 9, 17, 21, 30))).toBe('2026-10-17');
  });

  it('kennt den Vortag auch über Monats- und Jahresgrenzen', () => {
    expect(vortag('2026-11-01')).toBe('2026-10-31');
    expect(vortag('2027-01-01')).toBe('2026-12-31');
    expect(vortag('2028-03-01')).toBe('2028-02-29');
  });
});

describe('naechsteSerie', () => {
  it('beginnt beim ersten Mal mit Tag 1', () => {
    expect(naechsteSerie(null, 0, '2026-10-17')).toBe(1);
  });

  it('zählt weiter, wenn gestern abgeholt wurde', () => {
    expect(naechsteSerie('2026-10-16', 5, '2026-10-17')).toBe(6);
  });

  it('setzt nach einem verpassten Tag zurück', () => {
    expect(naechsteSerie('2026-10-15', 5, '2026-10-17')).toBe(1);
  });

  it('vergibt nichts, wenn heute schon abgeholt wurde', () => {
    expect(naechsteSerie('2026-10-17', 5, '2026-10-17')).toBeNull();
  });
});
