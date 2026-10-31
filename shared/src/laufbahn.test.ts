import { describe, expect, it } from 'vitest';
import {
  ERFOLGE,
  RAENGE,
  erstelleLaufbahnFuerBestand,
  findeNeueErfolge,
  getEinsatzXp,
  getFreischaltRang,
  getNaechsterRang,
  getRang,
  getRangFortschritt,
  istFahrzeugFreigeschaltet,
  istGueltigeLaufbahn,
  type ErfolgsStand,
} from './laufbahn.js';
import { FAHRZEUG_TYPEN, getKaufSperre, getStartfahrzeugTypen } from './fahrzeuge.js';
import { istVorlageKaufbar } from './einsatzErzeugung.js';
import { createNeuesSpiel, migriereSpielstand } from './spielstand.js';
import { fahrzeug, wache } from './testHilfen.js';

const leererStand: ErfolgsStand = {
  einsaetze: 0, perfekt: 0, wachen: 0, feuerwachen: 0, fahrzeuge: 0, fahrzeugTypen: [], ruf: 50, eigenesKrankenhaus: false, guthaben: 0,
};

describe('Ränge', () => {
  it('sind aufsteigend und beginnen bei 0 EP', () => {
    expect(RAENGE[0].abXp).toBe(0);
    RAENGE.slice(1).forEach((rang, i) => expect(rang.abXp).toBeGreaterThan(RAENGE[i].abXp));
  });

  it('kennen nur Fahrzeugtypen aus dem Katalog, jeden höchstens einmal', () => {
    const typen = new Set(FAHRZEUG_TYPEN.map((typ) => typ.typ));
    const freigeschaltet = RAENGE.flatMap((rang) => rang.fahrzeuge);
    freigeschaltet.forEach((typ) => expect(typen.has(typ)).toBe(true));
    expect(new Set(freigeschaltet).size).toBe(freigeschaltet.length);
  });

  it('lassen in Rang 1 für jede Wachenart ein Startfahrzeug übrig', () => {
    expect(getStartfahrzeugTypen('Rettungswache', 0).length).toBeGreaterThan(0);
    expect(getStartfahrzeugTypen('Feuerwache', 0).length).toBeGreaterThan(0);
  });

  it('berechnen Rang, nächsten Rang und Fortschritt', () => {
    expect(getRang(0).stufe).toBe(1);
    expect(getRang(RAENGE[1].abXp).stufe).toBe(2);
    expect(getRang(RAENGE[1].abXp - 1).stufe).toBe(1);
    expect(getNaechsterRang(0)?.stufe).toBe(2);
    expect(getNaechsterRang(10_000_000)).toBeUndefined();
    expect(getRangFortschritt(RAENGE[1].abXp / 2)).toBeCloseTo(0.5);
    expect(getRangFortschritt(10_000_000)).toBe(1);
  });
});

describe('Freischaltungen', () => {
  it('sperren Fahrzeuge unterhalb ihres Rangs beim Kauf', () => {
    const nef = FAHRZEUG_TYPEN.find((typ) => typ.typ === 'NEF')!;
    expect(istFahrzeugFreigeschaltet('NEF', 0)).toBe(false);
    expect(getKaufSperre(nef, wache(), false, 0)).toContain(getFreischaltRang('NEF').name);
    expect(getKaufSperre(nef, wache(), false, getFreischaltRang('NEF').abXp)).toBeNull();
    // Ohne EP-Angabe (Bot, ältere Aufrufer) keine Rangsperre
    expect(getKaufSperre(nef, wache(), false)).toBeNull();
  });

  it('erzeugen keinen Einsatzdruck für Fahrzeuge, die der Rang noch nicht kaufen kann', () => {
    const nefEinsatz = { requiredVehicles: [{ id: 'nef', category: 'NEF' as const, amount: 1 }] };
    expect(istVorlageKaufbar(nefEinsatz, ['Rettungswache'])).toBe(true);
    expect(istVorlageKaufbar(nefEinsatz, ['Rettungswache'], (typ) => istFahrzeugFreigeschaltet(typ, 0))).toBe(false);
  });
});

describe('Erfahrungspunkte', () => {
  it('steigen mit Größe des Einsatzes und guter Arbeit', () => {
    expect(getEinsatzXp({ reward: 300 })).toBe(8);
    expect(getEinsatzXp({ reward: 300, bewertung: { punkte: 100 } })).toBe(13);
    expect(getEinsatzXp({ reward: 2000, bewertung: { punkte: 100 } })).toBeGreaterThan(getEinsatzXp({ reward: 300, bewertung: { punkte: 100 } }));
  });
});

describe('Erfolge', () => {
  it('haben eindeutige IDs', () => {
    expect(new Set(ERFOLGE.map((e) => e.id)).size).toBe(ERFOLGE.length);
  });

  it('melden nur neu erreichte', () => {
    const stand = { ...leererStand, einsaetze: 60 };
    expect(findeNeueErfolge(stand, []).map((e) => e.id)).toEqual(['einsatz-1', 'einsatz-50']);
    expect(findeNeueErfolge(stand, ['einsatz-1']).map((e) => e.id)).toEqual(['einsatz-50']);
    expect(findeNeueErfolge(leererStand, [])).toEqual([]);
  });
});

describe('Laufbahn im Spielstand', () => {
  it('beginnt bei einem neuen Spiel bei 0', () => {
    expect(createNeuesSpiel().laufbahn).toEqual({ xp: 0, einsaetze: 0, perfekt: 0, erfolge: [] });
  });

  it('schaltet bei älteren Spielständen alle vorhandenen Fahrzeugtypen frei', () => {
    const alt = { ...createNeuesSpiel(), laufbahn: undefined, locations: [wache()], vehicles: [fahrzeug('rth', 'RTH'), fahrzeug('rtw', 'RTW')] };
    const geladen = migriereSpielstand(alt)!;
    expect(istFahrzeugFreigeschaltet('RTH', geladen.laufbahn!.xp)).toBe(true);
    expect(erstelleLaufbahnFuerBestand([], 30).xp).toBe(300);
  });

  it('verwirft eine beschädigte Laufbahn und baut sie neu auf', () => {
    expect(istGueltigeLaufbahn({ xp: Number.NaN, einsaetze: 0, perfekt: 0, erfolge: [] })).toBe(false);
    expect(istGueltigeLaufbahn({ xp: 5, einsaetze: 1, perfekt: 0, erfolge: ['x'] })).toBe(true);
    const kaputt = { ...createNeuesSpiel(), laufbahn: { xp: -5, einsaetze: 0, perfekt: 0, erfolge: [] } };
    expect(migriereSpielstand(kaputt)!.laufbahn!.xp).toBe(0);
  });
});
