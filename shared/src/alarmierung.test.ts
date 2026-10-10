import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './konfig.js';
import { alarmiereFahrzeuge, getWarteLage, rueckalarmiereFahrzeug } from './alarmierung.js';
import { getAktiveZuteilungen } from './daten.js';
import { getFahrzeugGeschwindigkeit } from './fahrzeuge.js';
import { getFahrzeitSekunden } from './geo.js';
import { T0, einsatz, fahrzeug, wache } from './testHilfen.js';

const locations = [wache()];

describe('alarmiereFahrzeuge', () => {
  it('teilt Fahrzeuge mit Fahrzeit (Luftlinie) zu', () => {
    const e = einsatz('sturz');
    const ergebnis = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations }, e.id, ['rtw'], T0);
    const zuteilung = ergebnis.incidents[0].alarmedVehicles[0];
    // Fahrzeit mit der Geschwindigkeit des Fahrzeugtyps aus dem Katalog
    // Ausrückzeit des Rettungsdienstes + Fahrzeit (Luftlinie)
    expect(zuteilung.etaSeconds).toBe(GAME_CONFIG.ausrueckzeitSekunden.Rettungsdienst + getFahrzeitSekunden(locations[0].coords, e.coords, getFahrzeugGeschwindigkeit('RTW')));
    expect(zuteilung.arrivalAt).toBe(T0 + zuteilung.etaSeconds * 1000);
    expect(ergebnis.vehicles[0].status).toBe('Alarmiert / auf Anfahrt');
  });

  it('ignoriert Fahrzeuge ohne Wache', () => {
    const e = einsatz('sturz');
    const ergebnis = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('lf', 'RTW', null)], locations }, e.id, ['lf'], T0);
    expect(ergebnis.incidents[0].alarmedVehicles).toHaveLength(0);
    expect(ergebnis.incidents[0].status).toBe('offen');
  });

  it('teilt ein Fahrzeug nicht doppelt zu (Nachalarmierung)', () => {
    const e = einsatz('reanimation');
    const vehicles = [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')];
    const erst = alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['rtw'], T0);
    const nach = alarmiereFahrzeuge({ ...erst, locations }, e.id, ['rtw', 'nef'], T0 + 1000);
    expect(nach.incidents[0].alarmedVehicles.map((a) => a.vehicleId)).toEqual(['rtw', 'nef']);
  });

  it('erlaubt keine Alarmierung mehr, sobald der Einsatz bearbeitet wird', () => {
    const e = { ...einsatz('sturz'), status: 'in_bearbeitung' as const };
    const vehicles = [fahrzeug('rtw', 'RTW')];
    const ergebnis = alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['rtw'], T0);
    expect(ergebnis.incidents[0]).toBe(e);
    expect(ergebnis.vehicles).toBe(vehicles);
  });
});

describe('alarmiereFahrzeuge – auf der Rückfahrt', () => {
  it('alarmiert von der aktuellen Position aus, ohne Ausrückzeit', () => {
    const e = einsatz('sturz');
    const von: [number, number] = [e.coords[0] + 0.02, e.coords[1]];
    const rtw = { ...fahrzeug('rtw', 'RTW'), status: 'Rückfahrt' as const, rueckfahrt: { von, startAt: T0, ankunftAt: T0 + 600_000 } };
    const ergebnis = alarmiereFahrzeuge({ incidents: [e], vehicles: [rtw], locations }, e.id, ['rtw'], T0);
    const zuteilung = ergebnis.incidents[0].alarmedVehicles[0];
    expect(zuteilung.startCoords).toEqual(von);
    expect(zuteilung.etaSeconds).toBe(getFahrzeitSekunden(von, e.coords, getFahrzeugGeschwindigkeit('RTW')));
    expect(ergebnis.vehicles[0].rueckfahrt).toBeUndefined();
    expect(ergebnis.vehicles[0].status).toBe('Alarmiert / auf Anfahrt');
  });
});

describe('alarmiereFahrzeuge – belegte Fahrzeuge', () => {
  it.each(['Alarmiert / auf Anfahrt', 'Im Einsatz'] as const)('alarmiert kein Fahrzeug mit Status „%s“', (status) => {
    const e = einsatz('sturz');
    const vehicles = [{ ...fahrzeug('rtw', 'RTW'), status }];
    const ergebnis = alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['rtw'], T0);
    expect(ergebnis.incidents[0].alarmedVehicles).toHaveLength(0);
    expect(ergebnis.vehicles[0].status).toBe(status);
  });

  it('alarmiert kein Fahrzeug, das schon einem anderen Einsatz zugeteilt ist', () => {
    const a = einsatz('sturz');
    const b = einsatz('atemnot');
    const vehicles = [fahrzeug('rtw', 'RTW')];
    const erst = alarmiereFahrzeuge({ incidents: [a, b], vehicles, locations }, a.id, ['rtw'], T0);
    // Status absichtlich zurücksetzen, um nur die Zuteilungsprüfung zu testen
    const zweit = alarmiereFahrzeuge(
      { incidents: erst.incidents, vehicles: [{ ...erst.vehicles[0], status: 'Einsatzbereit' }], locations },
      b.id,
      ['rtw'],
      T0 + 1000,
    );
    expect(zweit.incidents[1].alarmedVehicles).toHaveLength(0);
  });
});

describe('rueckalarmiereFahrzeug', () => {
  it('holt ein Fahrzeug vor Ort zurück – Einsatz wird wieder offen, Fahrzeug fährt von dort heim', () => {
    const e = einsatz('sturz');
    const alarmiert = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations }, e.id, ['rtw'], T0);
    const ankunft = alarmiert.incidents[0].alarmedVehicles[0].arrivalAt;
    const zurueck = rueckalarmiereFahrzeug({ ...alarmiert, locations }, e.id, 'rtw', ankunft + 60_000);
    expect(zurueck.incidents[0].status).toBe('offen');
    expect(zurueck.incidents[0].alarmedVehicles[0].freigegebenAt).toBe(ankunft + 60_000);
    expect(zurueck.vehicles[0].status).toBe('Rückfahrt');
    expect(zurueck.vehicles[0].rueckfahrt?.von).toEqual(e.coords);
  });

  it('erlaubt die erneute Alarmierung desselben Fahrzeugs', () => {
    const e = einsatz('sturz');
    const alarmiert = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations }, e.id, ['rtw'], T0);
    const zurueck = rueckalarmiereFahrzeug({ ...alarmiert, locations }, e.id, 'rtw', T0 + 10_000);
    const wieder = alarmiereFahrzeuge({ ...zurueck, locations }, e.id, ['rtw'], T0 + 20_000);
    expect(getAktiveZuteilungen(wieder.incidents[0])).toHaveLength(1);
    expect(wieder.vehicles[0].status).toBe('Alarmiert / auf Anfahrt');
  });

  it('meldet wartende Fahrzeuge, wenn Bedarf fehlt und nichts frei ist', () => {
    const e = einsatz('reanimation');
    const alarmiert = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations }, e.id, ['rtw'], T0);
    const spaeter = alarmiert.incidents[0].alarmedVehicles[0].arrivalAt + 1000;
    const lage = getWarteLage(alarmiert.incidents[0], { ...alarmiert, locations }, spaeter);
    expect(lage?.wartende.map((w) => w.vehicleId)).toEqual(['rtw']);
    expect(lage?.fehlt.length).toBeGreaterThan(0);
    expect(lage?.freiesFahrzeugFuerFehlendes).toBe(false);
  });
});
