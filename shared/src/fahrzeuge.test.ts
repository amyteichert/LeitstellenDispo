import { describe, expect, it } from 'vitest';
import { ALLE_EINSATZ_VORLAGEN, istVorlageErfuellbar } from './daten.js';
import {
  BEDARFS_KLASSEN,
  FAHRZEUG_TYPEN,
  ergaenzeBedarf,
  fahrzeugErfuelltBedarf,
  getFehlendenBedarf,
  istAusreichendBesetzt,
  ordneFahrzeugeBedarfZu,
  type FahrzeugBedarf,
} from './fahrzeuge.js';

const bedarf = (category: FahrzeugBedarf['category'], amount = 1): FahrzeugBedarf => ({ id: category, category, amount });

describe('Fahrzeugkatalog', () => {
  it('hat für jeden Typ vollständige, plausible Daten', () => {
    for (const typ of FAHRZEUG_TYPEN) {
      expect(typ.preis, typ.typ).toBeGreaterThan(0);
      expect(typ.geschwindigkeitKmh, typ.typ).toBeGreaterThan(20);
      expect(typ.besatzung, typ.typ).toBeGreaterThan(0);
      expect(typ.faehigkeiten.length, typ.typ).toBeGreaterThan(0);
      expect(typ.organisation === 'Rettungsdienst', typ.typ).toBe(typ.wachenArt === 'Rettungswache');
    }
  });

  it('ordnet die MVP-Fähigkeiten richtig zu', () => {
    const typ = (name: string) => FAHRZEUG_TYPEN.find((eintrag) => eintrag.typ === name)!;
    expect(typ('RTW').faehigkeiten).toEqual(['patientenversorgung', 'patiententransport']);
    expect(typ('NEF').faehigkeiten).toContain('notarzt');
    expect(typ('NEF').faehigkeiten).not.toContain('patiententransport');
    expect(typ('HLF 20').faehigkeiten).toEqual(expect.arrayContaining(['brandbekaempfung', 'technische_hilfe']));
    expect(typ('DLK 23/12').faehigkeiten).toContain('hoehenrettung');
  });

  it('kann jede Einsatzvorlage mit dem Katalog grundsätzlich erfüllen', () => {
    const alleTypen = FAHRZEUG_TYPEN.flatMap((eintrag) => Array.from({ length: 4 }, () => eintrag.typ));
    for (const vorlage of ALLE_EINSATZ_VORLAGEN) {
      for (const eintrag of vorlage.requiredVehicles) expect(BEDARFS_KLASSEN[eintrag.category], vorlage.id).toBeDefined();
      expect(istVorlageErfuellbar(vorlage, alleTypen), vorlage.id).toBe(true);
    }
  });
});

describe('Bedarfsklassen und Zuordnung', () => {
  it('lässt Technische Hilfe nur von LF/HLF leisten, nicht vom TLF', () => {
    expect(fahrzeugErfuelltBedarf('HLF 20', 'Technische Hilfe')).toBe(true);
    expect(fahrzeugErfuelltBedarf('LF 10', 'Technische Hilfe')).toBe(true);
    expect(fahrzeugErfuelltBedarf('TLF 3000', 'Technische Hilfe')).toBe(false);
    expect(fahrzeugErfuelltBedarf('TLF 3000', 'Löschfahrzeug')).toBe(true);
    expect(fahrzeugErfuelltBedarf('RTW', 'NEF')).toBe(false);
    expect(fahrzeugErfuelltBedarf('Unbekannt', 'RTW')).toBe(false);
  });

  it('zählt ein Fahrzeug nur einmal und verschiebt es dorthin, wo es gebraucht wird', () => {
    // TLF kann nur löschen → das LF muss die Technische Hilfe übernehmen
    const zuordnung = ordneFahrzeugeBedarfZu(
      [bedarf('Technische Hilfe'), bedarf('Löschfahrzeug')],
      [{ id: 'lf', type: 'LF 10' }, { id: 'tlf', type: 'TLF 3000' }],
    );
    expect(zuordnung).toEqual([['lf'], ['tlf']]);

    // Ein einzelnes LF kann nicht beide Plätze füllen
    expect(getFehlendenBedarf([bedarf('Technische Hilfe'), bedarf('Löschfahrzeug')], [{ id: 'lf', type: 'LF 10' }]))
      .toEqual([{ category: 'Löschfahrzeug', anzahl: 1 }]);
  });

  it('berücksichtigt Anzahlen', () => {
    const fahrzeuge = [{ id: 'a', type: 'LF 10' }, { id: 'b', type: 'HLF 20' }];
    expect(getFehlendenBedarf([bedarf('Löschfahrzeug', 3)], fahrzeuge)).toEqual([{ category: 'Löschfahrzeug', anzahl: 1 }]);
    expect(getFehlendenBedarf([bedarf('Löschfahrzeug', 2)], fahrzeuge)).toEqual([]);
  });

  it('führt Nachforderungen mit dem bestehenden Bedarf zusammen', () => {
    expect(ergaenzeBedarf([bedarf('RTW')], [bedarf('NEF'), bedarf('RTW')])).toEqual([bedarf('RTW', 2), bedarf('NEF')]);
  });
});

describe('Besatzung', () => {
  it('gilt ohne Angabe als voll besetzt, sonst nach Sollstärke', () => {
    expect(istAusreichendBesetzt({ type: 'RTW' })).toBe(true);
    expect(istAusreichendBesetzt({ type: 'RTW', besatzung: 2 })).toBe(true);
    expect(istAusreichendBesetzt({ type: 'RTW', besatzung: 1 })).toBe(false);
    expect(istAusreichendBesetzt({ type: 'HLF 20', besatzung: 6 })).toBe(false);
  });
});
