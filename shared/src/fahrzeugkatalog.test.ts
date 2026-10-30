import { describe, expect, it } from 'vitest';
import { ALLE_EINSATZ_VORLAGEN, istVorlageErfuellbar } from './daten.js';
import { BEDARFS_KLASSEN, FAHRZEUG_TYPEN, fahrzeugErfuelltBedarf, getFahrzeugTyp, getKaufSperre, type BedarfsKlasse } from './fahrzeuge.js';
import { LEHRGAENGE } from './ausbildung.js';
import { SONDER_ERWEITERUNGEN, hatSonderErweiterung, mitSonderErweiterung } from './wachen.js';
import { getGewaehlteGrafik, pruefeFahrzeuggrafik } from './fahrzeuggrafiken.js';
import { wache } from './testHilfen.js';

describe('Erweiterter Fahrzeugkatalog', () => {
  it('jede Bedarfsklasse kann mindestens ein Fahrzeugtyp erfüllen', () => {
    for (const klasse of Object.keys(BEDARFS_KLASSEN) as BedarfsKlasse[]) {
      expect(FAHRZEUG_TYPEN.some((typ) => fahrzeugErfuelltBedarf(typ.typ, klasse)), klasse).toBe(true);
    }
  });

  it('jede Einsatzvorlage lässt sich mit kaufbaren Fahrzeugen erfüllen', () => {
    // Je Organisation alle Typen einmal mehrfach – reicht für jede Vorlage
    const flotte = FAHRZEUG_TYPEN.flatMap((typ) => Array.from({ length: 6 }, () => typ.typ));
    for (const vorlage of ALLE_EINSATZ_VORLAGEN) expect(istVorlageErfuellbar(vorlage, flotte), vorlage.id).toBe(true);
  });

  it('jeder Typ hat eine Beschreibung und jede Pflicht-Qualifikation einen Lehrgang', () => {
    for (const typ of FAHRZEUG_TYPEN) {
      expect(typ.beschreibung.length, typ.typ).toBeGreaterThan(10);
      for (const q of typ.pflichtQualifikationen ?? []) {
        expect(LEHRGAENGE.some((l) => l.qualifikation === q && l.wachenArt === typ.wachenArt), `${typ.typ}: ${q}`).toBe(true);
      }
    }
  });

  it('Sonderfahrzeuge brauchen eine passende Erweiterung ihrer Wachenart', () => {
    for (const typ of FAHRZEUG_TYPEN.filter((t) => t.brauchtErweiterung)) {
      const erweiterung = SONDER_ERWEITERUNGEN.find((e) => e.id === typ.brauchtErweiterung);
      expect(erweiterung?.wachenArt, typ.typ).toBe(typ.wachenArt);
      expect(typ.keinStartfahrzeug, typ.typ).toBe(true);
    }
  });

  it('RTH ersetzt ein NEF, ein ITW einen RTW, ein ELW 2 einen ELW 1 – aber nicht umgekehrt', () => {
    expect(fahrzeugErfuelltBedarf('RTH', 'NEF')).toBe(true);
    expect(fahrzeugErfuelltBedarf('RTH', 'Krankentransport')).toBe(false);
    expect(fahrzeugErfuelltBedarf('ITW', 'RTW')).toBe(true);
    expect(fahrzeugErfuelltBedarf('RTW', 'ITW')).toBe(false);
    expect(fahrzeugErfuelltBedarf('ELW 2', 'Einsatzleitwagen')).toBe(true);
    expect(fahrzeugErfuelltBedarf('ELW 1', 'Einsatzleitwagen 2')).toBe(false);
  });
});

describe('Sonder-Erweiterungen', () => {
  it('schalten den Kauf frei – nur an der passenden Wachenart und nur einmal', () => {
    const rtw = wache('rw-1');
    const rth = getFahrzeugTyp('RTH')!;
    expect(getKaufSperre(rth, rtw, false)).toBe('Erweiterung nötig');

    const ergebnis = mitSonderErweiterung(rtw, 'hubschrauberlandeplatz');
    if ('fehler' in ergebnis) throw new Error(ergebnis.fehler);
    expect(hatSonderErweiterung(ergebnis.wache, 'hubschrauberlandeplatz')).toBe(true);
    expect(getKaufSperre(rth, ergebnis.wache, false)).toBeNull();
    expect(mitSonderErweiterung(ergebnis.wache, 'hubschrauberlandeplatz')).toHaveProperty('fehler');
    expect(mitSonderErweiterung(rtw, 'gefahrgut')).toHaveProperty('fehler');
    // Falsche Wachenart und Krankenhaus-Pflicht bleiben eigene Sperren
    expect(getKaufSperre(getFahrzeugTyp('HLF 20')!, rtw, false)).not.toBeNull();
    expect(getKaufSperre(getFahrzeugTyp('KTW')!, rtw, false)).toBe('erst mit eigenem Krankenhaus');
  });
});

describe('Fahrzeuggrafiken', () => {
  it('Fahrzeug-Wahl geht vor Typ-Wahl, sonst Standard', () => {
    expect(getGewaehlteGrafik({ type: 'RTW' }, {})).toBeUndefined();
    expect(getGewaehlteGrafik({ type: 'RTW' }, { RTW: 3 })).toBe(3);
    expect(getGewaehlteGrafik({ type: 'RTW', grafikId: 7 }, { RTW: 3 })).toBe(7);
  });

  it('prüft Name und Typ', () => {
    expect(pruefeFahrzeuggrafik('Mein HLF', 'HLF 20')).toBeNull();
    expect(pruefeFahrzeuggrafik('', 'HLF 20')).not.toBeNull();
    expect(pruefeFahrzeuggrafik('x'.repeat(41), 'HLF 20')).not.toBeNull();
    expect(pruefeFahrzeuggrafik('Raumschiff', 'Enterprise')).not.toBeNull();
  });
});

describe('Fahrzeugfarben', () => {
  it('Fahrzeug vor Wache, sonst Standard; ungültige Werte zählen nicht', async () => {
    const { getFahrzeugFarbe, istHelleFarbe, getSchriftFarbe } = await import('./wachen.js');
    const wachen = [{ id: 'w1', fahrzeugFarbe: '#f5c400' }, { id: 'w2' }];
    expect(getFahrzeugFarbe({ stationId: 'w2' }, wachen)).toBeUndefined();
    expect(getFahrzeugFarbe({ stationId: 'w1' }, wachen)).toBe('#f5c400');
    expect(getFahrzeugFarbe({ stationId: 'w1', farbe: '#1d4ed8' }, wachen)).toBe('#1d4ed8');
    expect(getFahrzeugFarbe({ stationId: 'w2', farbe: 'rot"><script>' }, wachen)).toBeUndefined();
    // Helle Farben bekommen dunkle Schrift
    expect(istHelleFarbe('#f8fafc')).toBe(true);
    expect(istHelleFarbe('#f5c400')).toBe(true);
    expect(istHelleFarbe('#c62828')).toBe(false);
    expect(getSchriftFarbe('#f5c400')).toBe('#1f2937');
    expect(getSchriftFarbe('#1d4ed8')).toBe('#ffffff');
  });
});
