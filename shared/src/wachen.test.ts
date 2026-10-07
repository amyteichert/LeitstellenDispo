import { describe, expect, it } from 'vitest';
import { fahrzeug, wache } from './testHilfen.js';
import {
  getStellplaetze,
  getStellplatzPreis,
  hatFreienStellplatz,
  mitStellplatzErweiterung,
  STELLPLATZ_CONFIG,
} from './wachen.js';

describe('Stellplätze', () => {
  it('Rettungswache startet mit 2, Feuerwache mit 3 Stellplätzen', () => {
    expect(getStellplaetze(wache('rw-1'))).toBe(2);
    expect(getStellplaetze(wache('fw-1', 'Feuerwache'))).toBe(3);
  });

  it('volle Wache hat keinen freien Stellplatz mehr', () => {
    const rw = wache('rw-1');
    expect(hatFreienStellplatz(rw, [fahrzeug('a', 'RTW')])).toBe(true);
    expect(hatFreienStellplatz(rw, [fahrzeug('a', 'RTW'), fahrzeug('b', 'NEF')])).toBe(false);
  });

  it('Erweiterung bringt einen Platz, jede weitere wird teurer, bis zum Maximum', () => {
    let rw = wache('rw-1');
    expect(getStellplatzPreis(rw)).toBe(20000);
    rw = mitStellplatzErweiterung(rw);
    expect(getStellplaetze(rw)).toBe(3);
    expect(getStellplatzPreis(rw)).toBe(32000);
    rw = mitStellplatzErweiterung(rw);
    expect(getStellplatzPreis(rw)).toBe(51000);

    for (let i = 2; i < STELLPLATZ_CONFIG.maxErweiterungen; i += 1) rw = mitStellplatzErweiterung(rw);
    expect(getStellplatzPreis(rw)).toBeNull();
    expect(getStellplaetze(rw)).toBe(2 + STELLPLATZ_CONFIG.maxErweiterungen);
  });
});
