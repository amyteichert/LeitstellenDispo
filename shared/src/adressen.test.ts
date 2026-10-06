import { describe, expect, it } from 'vitest';
import {
  adresseAusOsm,
  erzeugeAdresse,
  ermittleOrtFuerWache,
  formatAdresse,
  leseOrtAusText,
} from './adressen.js';
import { findeEinsatzVorlage } from './daten.js';
import { createSpielEinsatz, erzeugeEinsatzort, erzeugeZufallsEinsatz } from './einsatzErzeugung.js';
import { haversineKm } from './geo.js';
import { T0, fahrzeug, wache } from './testHilfen.js';

/** Vorhersagbarer „Zufall“ für Tests */
const folge = (...werte: number[]) => {
  let i = 0;
  return () => werte[i++ % werte.length];
};

describe('Adressen', () => {
  it('formatiert Adressen wie auf einem Einsatzfax', () => {
    expect(formatAdresse({ strasse: 'Musterstraße', hausnummer: '17', plz: '14770', ort: 'Brandenburg an der Havel' }))
      .toBe('Musterstraße 17, 14770 Brandenburg an der Havel');
    expect(formatAdresse({ strasse: 'Hauptstraße / Ecke Schulstraße', ort: 'Potsdam' })).toBe('Hauptstraße / Ecke Schulstraße, Potsdam');
  });

  it('liest PLZ und Ort aus einem Adresstext', () => {
    expect(leseOrtAusText('Musterstraße 12, 14467 Potsdam')).toEqual({ plz: '14467', ort: 'Potsdam' });
    expect(leseOrtAusText('Frei platzierbarer Standort')).toBeNull();
  });

  it('bestimmt den Ort einer Wache: Adresse → Text → bekannter Ort → Wachbereich', () => {
    const basis = { name: 'Wache Nord', coords: [48.775, 9.1771] as [number, number], details: '' };
    expect(ermittleOrtFuerWache({ ...basis, adresse: { strasse: 'X', plz: '14770', ort: 'Brandenburg an der Havel' } }))
      .toEqual({ plz: '14770', ort: 'Brandenburg an der Havel' });
    expect(ermittleOrtFuerWache({ ...basis, details: 'Hauptstraße 1, 14467 Potsdam' })).toEqual({ plz: '14467', ort: 'Potsdam' });
    expect(ermittleOrtFuerWache(basis)).toEqual({ plz: '70173', ort: 'Stuttgart' });
    expect(ermittleOrtFuerWache({ ...basis, coords: [54.9, 8.3] })).toEqual({ ort: 'Wachbereich Wache Nord' });
  });

  it('erzeugt je nach Einsatzart Gebäude-, Straßen- oder Kreuzungsadressen', () => {
    const ort = { plz: '70173', ort: 'Stuttgart' };
    expect(erzeugeAdresse(ort, 'gebaeude', folge(0, 0.1))).toEqual({ strasse: 'Hauptstraße', hausnummer: '13', ...ort });
    expect(erzeugeAdresse(ort, 'kreuzung', folge(0, 0)).strasse).toBe('Hauptstraße / Ecke Bahnhofstraße');
    expect(erzeugeAdresse(ort, 'strasse', folge(0, 0)).hausnummer).toBeUndefined();
  });

  it('übernimmt Adressen aus der OpenStreetMap-Suche', () => {
    expect(adresseAusOsm({ road: 'Kriegsbergstraße', house_number: '60', postcode: '70174', city: 'Stuttgart' }))
      .toEqual({ strasse: 'Kriegsbergstraße', hausnummer: '60', plz: '70174', ort: 'Stuttgart' });
    expect(adresseAusOsm({ village: 'Kleinkleckersdorf' })).toEqual({ strasse: 'Kleinkleckersdorf', hausnummer: undefined, plz: undefined, ort: 'Kleinkleckersdorf' });
    expect(adresseAusOsm({ road: 'Irgendwo' })).toBeNull();
    expect(adresseAusOsm(undefined)).toBeNull();
  });
});

describe('Einsatz mit echter Adresse', () => {
  it('hält Adresse, Adresstext und Koordinaten zusammen', () => {
    const w = wache();
    const ort = erzeugeEinsatzort(w, 1, { ortsArt: 'gebaeude' });
    const e = createSpielEinsatz(findeEinsatzVorlage('zimmerbrand')!, w, ort, T0);
    expect(e.coords).toEqual(ort.coords);
    expect(e.adresse).toEqual(ort.adresse);
    expect(e.address).toBe(formatAdresse(ort.adresse));
    expect(e.address).toMatch(/^.+ \d+, 70173 Stuttgart$/);
  });

  it('erzeugt Zufallseinsätze im Ort der Wache und nahe ihrer Position', () => {
    const w = { ...wache(), adresse: { strasse: 'Wachenweg', plz: '14770', ort: 'Brandenburg an der Havel' } };
    for (let i = 0; i < 30; i += 1) {
      const ergebnis = erzeugeZufallsEinsatz([w], [fahrzeug('rtw', 'RTW')], T0);
      if (!('einsatz' in ergebnis)) throw new Error('Einsatz erwartet');
      expect(ergebnis.einsatz.address).toContain('14770 Brandenburg an der Havel');
      expect(haversineKm(w.coords, ergebnis.einsatz.coords)).toBeLessThanOrEqual(1.25);
    }
  });

  it('beschreibt Verkehrsunfälle als Kreuzung', () => {
    const e = createSpielEinsatz(findeEinsatzVorlage('verkehrsunfall-rd')!, wache(), erzeugeEinsatzort(wache(), 1, findeEinsatzVorlage('verkehrsunfall-rd')!), T0);
    expect(e.address).toContain(' / Ecke ');
  });
});
