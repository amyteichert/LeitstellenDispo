import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge } from './alarmierung.js';
import { getFahrzeugPosition } from './geo.js';
import { T0, einsatz, fahrzeug, wache } from './testHilfen.js';

const locations = [wache()];

describe('getFahrzeugPosition (Luftlinie)', () => {
  it('liefert nichts für ein Fahrzeug an der Wache', () => {
    expect(getFahrzeugPosition(fahrzeug('rtw', 'RTW'), [], locations, T0)).toBeNull();
  });

  it('bewegt das Fahrzeug in gerader Linie von der Wache zum Einsatz', () => {
    const e = einsatz('sturz');
    const { incidents, vehicles } = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations }, e.id, ['rtw'], T0);
    const { arrivalAt } = incidents[0].alarmedVehicles[0];
    const wacheCoords = locations[0].coords;

    const start = getFahrzeugPosition(vehicles[0], incidents, locations, T0)!;
    expect(start.position).toEqual(wacheCoords);
    expect(start.unterwegs).toBe(true);

    const mitte = getFahrzeugPosition(vehicles[0], incidents, locations, (T0 + arrivalAt) / 2)!;
    expect(mitte.position[0]).toBeCloseTo((wacheCoords[0] + e.coords[0]) / 2, 6);
    expect(mitte.position[1]).toBeCloseTo((wacheCoords[1] + e.coords[1]) / 2, 6);

    const angekommen = getFahrzeugPosition(vehicles[0], incidents, locations, arrivalAt + 5000)!;
    expect(angekommen.position).toEqual(e.coords);
    expect(angekommen.unterwegs).toBe(false);
  });

  it('fährt nach dem Einsatz zurück zur Wache', () => {
    const rueckfahrend = { ...fahrzeug('rtw', 'RTW'), status: 'Rückfahrt' as const, rueckfahrt: { von: [48.784, 9.1771] as [number, number], startAt: T0, ankunftAt: T0 + 10_000 } };
    const mitte = getFahrzeugPosition(rueckfahrend, [], locations, T0 + 5000)!;
    expect(mitte.ziel).toEqual(locations[0].coords);
    expect(mitte.position[0]).toBeCloseTo((48.784 + locations[0].coords[0]) / 2, 6);
  });
});
