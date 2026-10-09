import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge } from './alarmierung.js';
import { findeZielKrankenhaus, STANDARD_KRANKENHAEUSER } from './krankenhaeuser.js';
import { berechneSpielTick } from './spielTick.js';
import { SPIELSTAND_VERSION, createNeuesSpiel, migriereSpielstand, type Spielstand } from './spielstand.js';
import { T0, eigenesKrankenhausWeitWeg, einsatz, fahrzeug, krankenhaus, wache } from './testHilfen.js';
import { haversineKm } from './geo.js';
import { erzeugeBesatzungFuer, synchronisiereBesatzung } from './personal.js';

describe('Krankenhäuser', () => {
  it('findet das nächste aufnahmebereite Krankenhaus', () => {
    const nah = { ...krankenhaus('nah', false), coords: [48.776, 9.1771] as [number, number] };
    const mittel = { ...krankenhaus('mittel'), coords: [48.79, 9.1771] as [number, number] };
    expect(findeZielKrankenhaus([48.775, 9.1771], [krankenhaus(), nah, mittel])?.id).toBe('mittel');
    expect(findeZielKrankenhaus([48.775, 9.1771], [nah])).toBeNull();
  });

  it('fährt nicht ins Nirgendwo: ohne Krankenhaus im Umkreis kein Transportziel', () => {
    expect(findeZielKrankenhaus([52.41, 12.53], STANDARD_KRANKENHAEUSER)).toBeNull();
  });

  it('entfernt früher erfundene Kliniken beim Laden', () => {
    const roh = { ...createNeuesSpiel(), krankenhaeuser: [...STANDARD_KRANKENHAEUSER, { ...STANDARD_KRANKENHAEUSER[0], id: 'kh-x', generiert: true }] };
    expect(migriereSpielstand(JSON.parse(JSON.stringify(roh)))!.krankenhaeuser).toHaveLength(STANDARD_KRANKENHAEUSER.length);
  });
});

describe('Spielstand speichern und laden', () => {
  it('startet ein neues Spiel ohne Wache und Fahrzeug, aber mit Krankenhäusern und Startguthaben', () => {
    const spiel = createNeuesSpiel();
    expect(spiel.version).toBe(SPIELSTAND_VERSION);
    expect(spiel.krankenhaeuser.length).toBeGreaterThan(0);
    expect(spiel.locations).toEqual([]);
    expect(spiel.vehicles).toEqual([]);
    expect(spiel.personal).toEqual([]);
    expect(spiel.balance).toBeGreaterThan(0);
  });

  it('übersteht JSON-Speichern und -Laden mit laufendem Transport unverändert', () => {
    const e = einsatz('sturz', undefined, undefined, { transport: true });
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations: [wache()] }, e.id, ['rtw'], T0);
    const kh = [krankenhaus(), eigenesKrankenhausWeitWeg()];
    const ende = berechneSpielTick({ ...start, locations: [wache()], krankenhaeuser: kh }, start.incidents[0].alarmedVehicles[0].arrivalAt).incidents[0].processingEndsAt!;
    let zustand = { ...start, locations: [wache()], krankenhaeuser: kh };
    for (const zeit of [start.incidents[0].alarmedVehicles[0].arrivalAt, ende]) {
      const r = berechneSpielTick(zustand, zeit);
      zustand = { ...zustand, vehicles: r.vehicles, incidents: r.incidents };
    }
    expect(zustand.incidents[0].status).toBe('transport');

    const personal = zustand.vehicles.flatMap((vehicle) => erzeugeBesatzungFuer(vehicle));
    const spielstand: Spielstand = {
      ...createNeuesSpiel(new Date(T0)),
      locations: zustand.locations,
      vehicles: synchronisiereBesatzung(zustand.vehicles, personal),
      personal,
      incidents: zustand.incidents,
      krankenhaeuser: kh,
    };
    const geladen = migriereSpielstand(JSON.parse(JSON.stringify(spielstand)));
    expect(geladen).toEqual(spielstand);

    // Offline-Fortschritt nach dem Laden: Einsatz wird abgeschlossen
    const spaeter = berechneSpielTick({ ...geladen!, locations: geladen!.locations }, T0 + 60 * 60 * 1000);
    expect(spaeter.abgeschlossen).toHaveLength(1);
  });

  it('rüstet einen Spielstand der Version 2 nach und entfernt die alte Start-Wache', () => {
    const alterEinsatz = {
      ...einsatz('sturz'),
      address: 'Sturz in der Nähe von Rettungswache Zentrum',
      adresse: undefined,
      patienten: undefined,
      nachforderungGeplant: undefined,
    };
    const v2 = {
      version: 2,
      gespeichertAm: new Date(T0).toISOString(),
      balance: 1234,
      transactions: [],
      locations: [{ ...wache('rettungswache-zentrum'), adresse: undefined }],
      vehicles: [fahrzeug('rtw', 'RTW', 'rettungswache-zentrum')],
      incidents: [alterEinsatz],
      completedIncidentHistory: [],
    };
    const geladen = migriereSpielstand(JSON.parse(JSON.stringify(v2)))!;
    expect(geladen.version).toBe(SPIELSTAND_VERSION);
    expect(geladen.balance).toBe(1234);
    // Die geschenkte Start-Wache entfällt seit Version 4 – samt ihrer Fahrzeuge und Einsätze
    expect(geladen.locations).toEqual([]);
    expect(geladen.vehicles).toEqual([]);
    expect(geladen.krankenhaeuser.length).toBeGreaterThanOrEqual(STANDARD_KRANKENHAEUSER.length);
  });

  it('verwirft unbrauchbare oder unbekannte Spielstände', () => {
    expect(migriereSpielstand(null)).toBeNull();
    expect(migriereSpielstand('kaputt')).toBeNull();
    expect(migriereSpielstand({ version: 1, locations: [], vehicles: [], incidents: [] })).toBeNull();
    expect(migriereSpielstand({ version: SPIELSTAND_VERSION })).toBeNull();
  });
});

describe('Version 4: alte Start-Wachen verschwinden', () => {
  it('entfernt Zentrum/Süd samt Fahrzeugen, Personal und Einsätzen, behält eigene Wachen und Geld', () => {
    const eigene = wache('meine-wache');
    const v3 = {
      ...createNeuesSpiel(new Date(T0)),
      version: 3,
      balance: 777,
      locations: [wache('rettungswache-zentrum'), wache('rettungswache-sued'), eigene],
      vehicles: [fahrzeug('alt', 'RTW', 'rettungswache-zentrum'), fahrzeug('neu', 'RTW', 'meine-wache')],
      personal: undefined,
      incidents: [einsatz('sturz')],
    };
    const geladen = migriereSpielstand(JSON.parse(JSON.stringify(v3)))!;
    expect(geladen.version).toBe(SPIELSTAND_VERSION);
    expect(geladen.locations.map((l) => l.id)).toEqual(['meine-wache']);
    expect(geladen.vehicles.map((v) => v.id)).toEqual(['neu']);
    expect(geladen.personal!.every((p) => p.wacheId === 'meine-wache')).toBe(true);
    expect(geladen.balance).toBe(777);
  });
});
