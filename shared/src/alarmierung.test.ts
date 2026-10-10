import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './konfig.js';
import { alarmiereFahrzeuge } from './alarmierung.js';
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

describe('alarmiereFahrzeuge – belegte Fahrzeuge', () => {
  it.each(['Alarmiert / auf Anfahrt', 'Im Einsatz', 'Rückfahrt'] as const)('alarmiert kein Fahrzeug mit Status „%s“', (status) => {
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
