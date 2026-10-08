import { describe, expect, it } from 'vitest';
import { ermittleErsteSchritte, type ErsteSchritteStand } from './ersteSchritte.js';
import { createNeuesSpiel } from './spielstand.js';

/** Neues Spiel, in dem die erste Wache mit Startfahrzeug gebaut ist */
const mitWache = (): ErsteSchritteStand => ({ ...createNeuesSpiel(), locations: [{ type: 'station' }], vehicles: [{ id: 'fahrzeug-1' }] });

const erledigt = (stand: ErsteSchritteStand) =>
  ermittleErsteSchritte(stand).filter((schritt) => schritt.erledigt).map((schritt) => schritt.id);

describe('ermittleErsteSchritte', () => {
  it('hat bei einem neuen Spiel nichts erledigt', () => {
    expect(erledigt(createNeuesSpiel())).toEqual([]);
  });

  it('zählt einen alarmierten Einsatz', () => {
    const stand = { ...mitWache(), incidents: [{ alarmedVehicles: [{ vehicleId: 'fahrzeug-1' }] }] } as unknown as ErsteSchritteStand;
    expect(erledigt(stand)).toEqual(['wache', 'alarmieren']);
  });

  it('ein abgeschlossener Einsatz erledigt auch das Alarmieren', () => {
    expect(erledigt({ ...mitWache(), completedIncidentHistory: [{ id: 'e1' }] })).toEqual(['wache', 'alarmieren', 'abschliessen']);
  });

  it('erkennt gekaufte Fahrzeuge und gebaute Wachen', () => {
    const neu = mitWache();
    expect(erledigt(neu)).toEqual(['wache']);
    const stand: ErsteSchritteStand = { ...neu, vehicles: [...neu.vehicles, { id: 'fahrzeug-2' }] };
    expect(erledigt(stand)).toEqual(['wache', 'fahrzeug']);
  });
});
