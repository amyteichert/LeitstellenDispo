import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge, erstelleAlarmVorschlag, zieheFahrzeugZurueck } from './alarmierung.js';
import { berechneSpielTick } from './spielTick.js';
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
    expect(zuteilung.etaSeconds).toBe(getFahrzeitSekunden(locations[0].coords, e.coords, getFahrzeugGeschwindigkeit('RTW')));
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

describe('zieheFahrzeugZurueck (Rückalarmierung)', () => {
  it('löst die Blockade „RTW wartet auf NEF, NEF wartet auf RTW“', () => {
    const a = einsatz('brustschmerzen');
    const b = einsatz('brustschmerzen');
    const vehicles = [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')];
    let zustand = { incidents: [a, b], vehicles, locations };
    zustand = { ...zustand, ...alarmiereFahrzeuge(zustand, a.id, ['rtw'], T0) };
    zustand = { ...zustand, ...alarmiereFahrzeuge(zustand, b.id, ['nef'], T0) };
    // Ohne Rückalarmierung: auch nach einem Tag kein Fortschritt
    const festgefahren = berechneSpielTick(zustand, T0 + 24 * 3600_000);
    const blockiert = { ...zustand, vehicles: festgefahren.vehicles, incidents: festgefahren.incidents };
    expect(blockiert.incidents.map((i) => i.status)).toEqual(['alarmiert', 'alarmiert']);
    expect(erstelleAlarmVorschlag(blockiert.incidents[0], blockiert).fahrzeugIds).toEqual([]);

    // NEF von B abziehen → fährt zurück, B ist wieder offen
    const jetzt = T0 + 24 * 3600_000;
    const zurueck = { ...blockiert, ...zieheFahrzeugZurueck(blockiert, b.id, 'nef', jetzt) };
    expect(zurueck.incidents[1].status).toBe('offen');
    expect(zurueck.incidents[1].alarmedVehicles).toHaveLength(0);
    const nef = zurueck.vehicles.find((v) => v.id === 'nef')!;
    expect(nef.status).toBe('Rückfahrt');
    expect(nef.rueckfahrt?.von).toEqual(b.coords);

    // Nach der Rückfahrt kann das NEF zu A nachalarmiert werden, A wird abgearbeitet
    const anWache = berechneSpielTick(zurueck, nef.rueckfahrt!.ankunftAt);
    let weiter = { ...zurueck, vehicles: anWache.vehicles, incidents: anWache.incidents };
    expect(erstelleAlarmVorschlag(weiter.incidents[0], weiter).fahrzeugIds).toEqual(['nef']);
    weiter = { ...weiter, ...alarmiereFahrzeuge(weiter, a.id, ['nef'], nef.rueckfahrt!.ankunftAt) };
    const fertig = berechneSpielTick(weiter, nef.rueckfahrt!.ankunftAt + 3600_000);
    expect(fertig.abgeschlossen.map((i) => i.id)).toEqual([a.id]);
  });

  it('startet die Rückfahrt von der aktuellen Position auf der Anfahrt', () => {
    const e = einsatz('sturz');
    const zustand = { incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations };
    const alarmiert = { ...zustand, ...alarmiereFahrzeuge(zustand, e.id, ['rtw'], T0) };
    const { arrivalAt } = alarmiert.incidents[0].alarmedVehicles[0];
    const mitte = T0 + (arrivalAt - T0) / 2;
    const ergebnis = zieheFahrzeugZurueck(alarmiert, e.id, 'rtw', mitte);
    const rueckfahrt = ergebnis.vehicles[0].rueckfahrt!;
    expect(rueckfahrt.von[0]).toBeCloseTo((locations[0].coords[0] + e.coords[0]) / 2, 4);
    // Halber Weg zurück dauert ungefähr die halbe Anfahrt
    expect(Math.abs((rueckfahrt.ankunftAt - mitte) - (arrivalAt - T0) / 2)).toBeLessThanOrEqual(1000);
  });

  it('ändert nichts, sobald der Einsatz in Bearbeitung ist oder das Fahrzeug nicht zugeteilt ist', () => {
    const e = einsatz('sturz');
    const zustand = { incidents: [e], vehicles: [fahrzeug('rtw', 'RTW'), fahrzeug('rtw2', 'RTW')], locations };
    const alarmiert = { ...zustand, ...alarmiereFahrzeuge(zustand, e.id, ['rtw'], T0) };
    expect(zieheFahrzeugZurueck(alarmiert, e.id, 'rtw2', T0)).toEqual({ incidents: alarmiert.incidents, vehicles: alarmiert.vehicles });
    expect(zieheFahrzeugZurueck(alarmiert, 'gibt-es-nicht', 'rtw', T0).incidents).toBe(alarmiert.incidents);
    const tick = berechneSpielTick(alarmiert, alarmiert.incidents[0].alarmedVehicles[0].arrivalAt);
    const inBearbeitung = { ...alarmiert, vehicles: tick.vehicles, incidents: tick.incidents };
    expect(inBearbeitung.incidents[0].status).toBe('in_bearbeitung');
    expect(zieheFahrzeugZurueck(inBearbeitung, e.id, 'rtw', T0 + 1).incidents).toBe(inBearbeitung.incidents);
  });

  it('behält den Einsatz als „alarmiert“, wenn noch andere Fahrzeuge zugeteilt sind', () => {
    const e = einsatz('reanimation');
    const zustand = { incidents: [e], vehicles: [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')], locations };
    const alarmiert = { ...zustand, ...alarmiereFahrzeuge(zustand, e.id, ['rtw', 'nef'], T0) };
    const ergebnis = zieheFahrzeugZurueck(alarmiert, e.id, 'nef', T0 + 1000);
    expect(ergebnis.incidents[0].status).toBe('alarmiert');
    expect(ergebnis.incidents[0].alarmedVehicles.map((a) => a.vehicleId)).toEqual(['rtw']);
  });
});
