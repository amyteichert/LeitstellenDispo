import { describe, expect, it } from 'vitest';
import { createNeuesSpiel } from './spielstand.js';
import { erstelleWache, kaufeFahrzeug, loescheWache } from './aktionen.js';
import { erzeugeZufall } from './zufall.js';

const jetzt = 1_700_000_000_000;

describe('kaufeFahrzeug', () => {
  it('kauft ein passendes Fahrzeug und bucht den Preis ab', () => {
    const start = createNeuesSpiel(new Date(jetzt));
    const ergebnis = kaufeFahrzeug(start, 'rettungswache-zentrum', 'RTW', jetzt, erzeugeZufall(1));
    expect('spielstand' in ergebnis).toBe(true);
    if ('spielstand' in ergebnis) {
      expect(ergebnis.spielstand.balance).toBe(start.balance - 4000);
      expect(ergebnis.spielstand.vehicles).toHaveLength(start.vehicles.length + 1);
      // Startzustand bleibt unverändert (reine Funktion)
      expect(start.vehicles).toHaveLength(1);
    }
  });

  it('lehnt ein Fahrzeug der falschen Wachenart ab', () => {
    const start = createNeuesSpiel(new Date(jetzt));
    const ergebnis = kaufeFahrzeug(start, 'rettungswache-zentrum', 'LF 10', jetzt);
    expect('fehler' in ergebnis).toBe(true);
  });

  it('lehnt bei zu wenig Guthaben ab', () => {
    const start = { ...createNeuesSpiel(new Date(jetzt)), balance: 100 };
    const ergebnis = kaufeFahrzeug(start, 'rettungswache-zentrum', 'RTW', jetzt);
    expect('fehler' in ergebnis).toBe(true);
  });
});

describe('erstelleWache / loescheWache', () => {
  it('baut eine Feuerwache mit Startfahrzeug und ergänzt ein Krankenhaus', () => {
    const start = { ...createNeuesSpiel(new Date(jetzt)), balance: 50000 };
    const ergebnis = erstelleWache(start, {
      name: 'Feuerwache Nord',
      stationKind: 'Feuerwache',
      coords: [48.8, 9.2],
      details: '',
      startFahrzeugTyp: 'HLF 20',
      funkrufname: '',
    }, jetzt, erzeugeZufall(2));
    expect('spielstand' in ergebnis).toBe(true);
    if ('spielstand' in ergebnis) {
      const { spielstand, id } = ergebnis;
      expect(spielstand.locations.some((location) => location.id === id)).toBe(true);
      expect(spielstand.balance).toBe(start.balance - 15000 - 8000);
      // löschen entfernt die Wache wieder
      const nachher = loescheWache(spielstand, id);
      expect(nachher.locations.some((location) => location.id === id)).toBe(false);
    }
  });
});
