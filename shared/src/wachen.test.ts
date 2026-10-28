import { describe, expect, it } from 'vitest';
import { ERSTE_WACHE_HOECHSTPREIS, START_GUTHABEN, WACHEN_PREISE, getWachenPreis } from './daten.js';
import { fahrzeug, wache } from './testHilfen.js';
import {
  getStellplaetze,
  getStellplatzPreis,
  hatFreienStellplatz,
  mitStellplatzErweiterung,
  mitWachenAnpassung,
  STELLPLATZ_CONFIG,
  WACHENNAME_MAX_LAENGE,
} from './wachen.js';

describe('Wache anpassen', () => {
  it('ändert Namen und Logo-Farbe, Standardfarbe entfernt die eigene', () => {
    const ergebnis = mitWachenAnpassung(wache('rw-1'), { name: '  Rettungswache Nord ', logoFarbe: '#DBEAFE' });
    expect(ergebnis).toMatchObject({ wache: { name: 'Rettungswache Nord', logoFarbe: '#dbeafe' } });
    if (!('wache' in ergebnis)) throw new Error('erwartet Wache');
    expect(mitWachenAnpassung(ergebnis.wache, { logoFarbe: '#f4f6f8' })).not.toHaveProperty('wache.logoFarbe');
    expect(mitWachenAnpassung(ergebnis.wache, { logoFarbe: null })).not.toHaveProperty('wache.logoFarbe');
  });

  it('lehnt leere oder zu lange Namen und ungültige Farben ab', () => {
    expect(mitWachenAnpassung(wache('rw-1'), { name: '   ' })).toHaveProperty('fehler');
    expect(mitWachenAnpassung(wache('rw-1'), { name: 'x'.repeat(WACHENNAME_MAX_LAENGE + 1) })).toHaveProperty('fehler');
    expect(mitWachenAnpassung(wache('rw-1'), { logoFarbe: 'red;background:url(x)' })).toHaveProperty('fehler');
  });
});

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

describe('Preis der ersten Wache', () => {
  it('die allererste Wache kostet höchstens 10.000 €, danach normal', () => {
    expect(getWachenPreis('Feuerwache', 0)).toBe(ERSTE_WACHE_HOECHSTPREIS);
    expect(getWachenPreis('Rettungswache', 0)).toBe(Math.min(WACHEN_PREISE.Rettungswache, ERSTE_WACHE_HOECHSTPREIS));
    expect(getWachenPreis('Feuerwache', 1)).toBe(WACHEN_PREISE.Feuerwache);
    // Mit Startguthaben: Feuerwache + teuerstes Start-LF passt
    expect(getWachenPreis('Feuerwache', 0) + 8000).toBeLessThanOrEqual(START_GUTHABEN);
  });
});
