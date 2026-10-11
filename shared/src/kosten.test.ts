import { describe, expect, it } from 'vitest';
import {
  KOSTEN_CONFIG,
  LAUFENDE_KOSTEN_LABEL,
  bucheLaufendeKosten,
  getGehaltJeStunde,
  getLaufendeKosten,
  getWachenKostenJeStunde,
  rechneLaufendeKostenAb,
} from './kosten.js';
import type { Mitarbeiter } from './personal.js';
import { T0, fahrzeug, wache } from './testHilfen.js';

const MINUTE = 60 * 1000;
const person = (id: string, qualifikationen: Mitarbeiter['qualifikationen'] = [], wacheId = 'rw-1'): Mitarbeiter => ({ id, name: id, wacheId, qualifikationen });

describe('Laufende Kosten', () => {
  it('Gehalt: Grundgehalt plus Zulagen je Qualifikation', () => {
    expect(getGehaltJeStunde(person('a'))).toBe(KOSTEN_CONFIG.gehaltJeStunde);
    expect(getGehaltJeStunde(person('b', ['notfallsanitaeter', 'notarzt'])))
      .toBe(KOSTEN_CONFIG.gehaltJeStunde + KOSTEN_CONFIG.zulageJeStunde.notfallsanitaeter + KOSTEN_CONFIG.zulageJeStunde.notarzt);
  });

  it('summiert Gehälter, Wachen (mit Ausbau) und Fahrzeuge', () => {
    const rw = { ...wache('rw-1'), ausbau: { stellplatz: 2 } };
    const fw = wache('fw-1', 'Feuerwache');
    const kosten = getLaufendeKosten({
      locations: [rw, fw],
      vehicles: [fahrzeug('rtw', 'RTW'), fahrzeug('hlf', 'HLF 20', 'fw-1')],
      personal: [person('a', ['notfallsanitaeter']), person('b')],
      krankenhaeuser: [],
    });
    expect(kosten.wachen).toBe(KOSTEN_CONFIG.wacheJeStunde.Rettungswache + 2 * KOSTEN_CONFIG.ausbaustufeJeStunde + KOSTEN_CONFIG.wacheJeStunde.Feuerwache);
    expect(kosten.fahrzeuge).toBe(2 * KOSTEN_CONFIG.fahrzeugJeStunde);
    expect(kosten.gehaelter).toBe(2 * KOSTEN_CONFIG.gehaltJeStunde + KOSTEN_CONFIG.zulageJeStunde.notfallsanitaeter);
    expect(kosten.krankenhaeuser).toBe(0);
    expect(kosten.gesamt).toBe(kosten.wachen + kosten.fahrzeuge + kosten.gehaelter);
  });

  it('Kosten einer einzelnen Wache enthalten nur ihr Personal und ihre Fahrzeuge', () => {
    const zustand = { vehicles: [fahrzeug('rtw', 'RTW'), fahrzeug('hlf', 'HLF 20', 'fw-1')], personal: [person('a'), person('b', [], 'fw-1')] };
    expect(getWachenKostenJeStunde(wache('rw-1'), zustand))
      .toBe(KOSTEN_CONFIG.wacheJeStunde.Rettungswache + KOSTEN_CONFIG.fahrzeugJeStunde + KOSTEN_CONFIG.gehaltJeStunde);
  });

  it('rechnet volle Minuten ab und behält den Rest für später', () => {
    expect(rechneLaufendeKostenAb(600, T0, T0 + 30_000)).toEqual({ abgerechnetBis: T0, betrag: 0 });
    expect(rechneLaufendeKostenAb(600, T0, T0 + 2 * MINUTE + 30_000)).toEqual({ abgerechnetBis: T0 + 2 * MINUTE, betrag: 20 });
  });

  it('beginnt ohne Kosten neu, wenn noch nie abgerechnet wurde oder das Spiel länger zu war', () => {
    expect(rechneLaufendeKostenAb(600, undefined, T0)).toEqual({ abgerechnetBis: T0, betrag: 0 });
    const spaeter = T0 + KOSTEN_CONFIG.maxLueckeMs + MINUTE;
    expect(rechneLaufendeKostenAb(600, T0, spaeter)).toEqual({ abgerechnetBis: spaeter, betrag: 0 });
  });

  it('bucht eine Sammelbuchung je Stunde', () => {
    const stunde = Math.floor(T0 / (60 * MINUTE)) * 60 * MINUTE;
    let buchungen = bucheLaufendeKosten([], 10, stunde + MINUTE);
    buchungen = bucheLaufendeKosten(buchungen, 15, stunde + 5 * MINUTE);
    expect(buchungen).toHaveLength(1);
    expect(buchungen[0]).toMatchObject({ kind: 'Ausgabe', label: LAUFENDE_KOSTEN_LABEL, amount: 25 });
    buchungen = bucheLaufendeKosten(buchungen, 7, stunde + 61 * MINUTE);
    expect(buchungen.map((b) => b.amount)).toEqual([7, 25]);
    expect(bucheLaufendeKosten(buchungen, 0, stunde)).toBe(buchungen);
  });
});
