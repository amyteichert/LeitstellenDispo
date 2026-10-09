import { describe, expect, it } from 'vitest';
import {
  EINSATZ_VORLAGEN,
  findeEinsatzVorlage,
  getBedarfsAbdeckung,
  istVorlageErfuellbar,
} from './daten.js';
import { FAHRZEUG_TYPEN, getFahrzeugKategorie, getFahrzeugTypenFuerWache } from './fahrzeuge.js';
import { erzeugeZufallsEinsatz } from './einsatzErzeugung.js';
import { haversineKm } from './geo.js';
import { einsatz, fahrzeug, wache } from './testHilfen.js';

const alleVorlagen = [...EINSATZ_VORLAGEN.Rettungswache, ...EINSATZ_VORLAGEN.Feuerwache];

describe('Spieldaten', () => {
  it('hat eindeutige Vorlagen-IDs und Fahrzeugtypen', () => {
    const ids = alleVorlagen.map((vorlage) => vorlage.id);
    expect(new Set(ids).size).toBe(ids.length);
    const typen = FAHRZEUG_TYPEN.map((eintrag) => eintrag.typ);
    expect(new Set(typen).size).toBe(typen.length);
  });

  it('eskaliert nur in existierende, größere Einsätze', () => {
    for (const vorlage of alleVorlagen.filter((eintrag) => eintrag.eskalation)) {
      const ziel = findeEinsatzVorlage(vorlage.eskalation!.zielVorlageId);
      expect(ziel, `Eskalationsziel von ${vorlage.id}`).toBeDefined();
      expect(ziel!.reward, `${vorlage.id} → ${ziel!.id}`).toBeGreaterThan(vorlage.reward);
      expect(ziel!.organization).toBe(vorlage.organization);
    }
  });

  it('bietet je Wachenart nur passende Fahrzeuge an', () => {
    expect(getFahrzeugTypenFuerWache('Rettungswache').map((eintrag) => eintrag.typ)).toEqual(['RTW', 'NEF', 'KTW']);
    expect(getFahrzeugTypenFuerWache('Feuerwache').every((eintrag) => eintrag.wachenArt === 'Feuerwache')).toBe(true);
    expect(getFahrzeugKategorie('HLF 20')).toBe('Löschfahrzeug');
    expect(getFahrzeugKategorie('Unbekannt')).toBeNull();
  });
});

describe('Machbarkeit und Abdeckung', () => {
  it('erkennt, ob die Fahrzeuge für eine Vorlage reichen', () => {
    const zimmerbrand = findeEinsatzVorlage('zimmerbrand')!;
    expect(istVorlageErfuellbar(zimmerbrand, ['LF 10', 'LF 20'])).toBe(false);
    expect(istVorlageErfuellbar(zimmerbrand, ['LF 10', 'HLF 20', 'DLK 23/12'])).toBe(true);
  });

  it('zählt alarmierte Fahrzeuge je Kategorie', () => {
    const e = {
      ...einsatz('reanimation'),
      alarmedVehicles: [{ vehicleId: 'rtw', distanceKm: 1, etaSeconds: 60, arrivalAt: 0 }],
    };
    const abdeckung = getBedarfsAbdeckung(e, [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')], 0);
    expect(abdeckung).toEqual([
      { category: 'RTW', amount: 1, alarmiert: 1, vorOrt: 1 },
      { category: 'NEF', amount: 1, alarmiert: 0, vorOrt: 0 },
    ]);
  });
});

describe('erzeugeZufallsEinsatz', () => {
  it('erzeugt ohne NEF nie einen RD-2-Einsatz', () => {
    for (let i = 0; i < 200; i += 1) {
      const ergebnis = erzeugeZufallsEinsatz([wache()], [fahrzeug('rtw', 'RTW')]);
      if (!('einsatz' in ergebnis)) throw new Error('Einsatz erwartet');
      expect(['RD 1', 'KTP']).toContain(ergebnis.einsatz.stichwort);
    }
  });

  it('erzeugt Einsätze in der Nähe der Wache', () => {
    const w = wache();
    for (let i = 0; i < 50; i += 1) {
      const ergebnis = erzeugeZufallsEinsatz([w], [fahrzeug('rtw', 'RTW')]);
      if (!('einsatz' in ergebnis)) throw new Error('Einsatz erwartet');
      expect(haversineKm(w.coords, ergebnis.einsatz.coords)).toBeLessThanOrEqual(1.25);
    }
  });

  it('meldet einen Fehler ohne Wache bzw. ohne passende Fahrzeuge', () => {
    expect(erzeugeZufallsEinsatz([], [])).toEqual({ fehler: 'keine-wache' });
    expect(erzeugeZufallsEinsatz([wache('fw', 'Feuerwache')], [fahrzeug('rtw', 'RTW', 'fw')])).toEqual({ fehler: 'keine-machbare-vorlage' });
  });
});
