import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge } from './alarmierung.js';
import type { Mitarbeiter } from './personal.js';
import { T0, einsatz, fahrzeug, wache } from './testHilfen.js';
import type { MapLocation } from './typen.js';
import {
  erhoeheStress,
  getAusrueckVerzoegerung,
  getBewerberFaktor,
  getGrundZufriedenheit,
  getKuendigungsChance,
  getStress,
  getZufriedenheit,
  mitZufriedenheitsAusbau,
  pruefeKuendigungen,
} from './zufriedenheit.js';

const STUNDE = 60 * 60 * 1000;
const person = (id: string, ausgebildet = false): Mitarbeiter => ({ id, name: id, wacheId: 'rw-1', qualifikationen: [], ausgebildet });
/** Wache mit so viel Stress, dass die Zufriedenheit deutlich unter 40 % fällt */
const gestresst = (w: MapLocation = wache('rw-1')): MapLocation => ({ ...w, stress: { wert: 100, stand: T0 } });

describe('Zufriedenheit', () => {
  it('Grundniveau 60 %, Ausbauten heben es (höchstens 100 %)', () => {
    let rw = wache('rw-1');
    expect(getGrundZufriedenheit(rw)).toBe(60);
    rw = mitZufriedenheitsAusbau(mitZufriedenheitsAusbau(rw, 'aufenthaltsraum'), 'kueche');
    expect(getGrundZufriedenheit(rw)).toBe(78);
  });

  it('nur Dauerstress senkt die Zufriedenheit, Stress baut sich mit der Zeit ab', () => {
    let rw = wache('rw-1');
    rw = erhoeheStress([rw], ['rw-1', 'rw-1', 'rw-1'], T0)[0];
    expect(getStress(rw, T0)).toBe(30);
    expect(getZufriedenheit(rw, T0)).toBe(60); // unter der Schwelle: kein Abzug

    rw = erhoeheStress([rw], Array(5).fill('rw-1'), T0)[0];
    expect(getStress(rw, T0)).toBe(80);
    expect(getZufriedenheit(rw, T0)).toBe(28); // 60 − (80 − 40) × 0,8

    expect(getStress(rw, T0 + 2 * STUNDE)).toBe(40);
    expect(getZufriedenheit(rw, T0 + 2 * STUNDE)).toBe(60);
  });

  it('unzufriedenes Personal rückt langsamer aus – auch in der Alarmierung', () => {
    const rw = gestresst();
    expect(getAusrueckVerzoegerung(wache('rw-1'), T0)).toBe(0);
    expect(getAusrueckVerzoegerung(rw, T0)).toBe(48); // Zufriedenheit 12 % → 48 Sek.

    const e = einsatz('sturz');
    const vehicles = [fahrzeug('rtw', 'RTW')];
    const normal = alarmiereFahrzeuge({ incidents: [e], vehicles, locations: [wache('rw-1')] }, e.id, ['rtw'], T0);
    const langsam = alarmiereFahrzeuge({ incidents: [e], vehicles, locations: [rw] }, e.id, ['rtw'], T0);
    expect(langsam.incidents[0].alarmedVehicles[0].etaSeconds - normal.incidents[0].alarmedVehicles[0].etaSeconds).toBe(48);
  });

  it('hohe Zufriedenheit bringt bessere Bewerber', () => {
    expect(getBewerberFaktor(100)).toBe(1.5);
    expect(getBewerberFaktor(0)).toBe(0.5);
  });
});

describe('Kündigungen', () => {
  it('erst unter 40 %, ausgebildetes Personal kündigt seltener', () => {
    expect(getKuendigungsChance(person('a'), 40)).toBe(0);
    expect(getKuendigungsChance(person('a'), 0)).toBeCloseTo(0.05);
    expect(getKuendigungsChance(person('a', true), 0)).toBeCloseTo(0.015);
  });

  it('prüft stündlich und nicht bei zufriedenem Personal', () => {
    const start = pruefeKuendigungen([wache('rw-1')], [person('a')], () => false, T0, () => 0);
    expect(start.locations[0].kuendigungGeprueftAt).toBe(T0);

    // Zufriedene Wache: niemand kündigt, selbst wenn der Zufall „ja“ sagt
    const zufrieden = pruefeKuendigungen(start.locations, [person('a')], () => false, T0 + 3 * STUNDE, () => 0);
    expect(zufrieden.kuendigungen).toHaveLength(0);
    expect(zufrieden.locations[0].kuendigungGeprueftAt).toBe(T0 + 3 * STUNDE);
  });

  it('bei Unzufriedenheit kündigt Personal – nicht wer im Lehrgang oder unterwegs ist', () => {
    const rw = { ...gestresst(), kuendigungGeprueftAt: T0 };
    const personal: Mitarbeiter[] = [
      person('reserve'),
      { ...person('lehrgang'), inAusbildungBis: T0 + 10 * STUNDE },
      { ...person('unterwegs'), fahrzeugId: 'rtw' },
    ];
    const ergebnis = pruefeKuendigungen([rw], personal, (id) => id === 'rtw', T0 + STUNDE, () => 0);
    expect(ergebnis.kuendigungen.map((k) => k.personId)).toEqual(['reserve']);
    expect(ergebnis.personal.map((p) => p.id)).toEqual(['lehrgang', 'unterwegs']);
  });
});
