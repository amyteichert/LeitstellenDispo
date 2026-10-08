import { describe, expect, it } from 'vitest';
import { ermittleErsteSchritte, type ErsteSchritteStand } from './ersteSchritte.js';
import { createNeuesSpiel } from './spielstand.js';

const erledigt = (stand: ErsteSchritteStand) =>
  ermittleErsteSchritte(stand).filter((schritt) => schritt.erledigt).map((schritt) => schritt.id);

describe('ermittleErsteSchritte', () => {
  it('hat bei einem neuen Spiel nichts erledigt', () => {
    expect(erledigt(createNeuesSpiel())).toEqual([]);
  });

  it('zählt einen alarmierten Einsatz', () => {
    const stand = { ...createNeuesSpiel(), incidents: [{ alarmedVehicles: [{ vehicleId: 'fahrzeug-1' }] }] } as unknown as ErsteSchritteStand;
    expect(erledigt(stand)).toEqual(['alarmieren']);
  });

  it('ein abgeschlossener Einsatz erledigt auch das Alarmieren', () => {
    expect(erledigt({ ...createNeuesSpiel(), completedIncidentHistory: [{ id: 'e1' }] })).toEqual(['alarmieren', 'abschliessen']);
  });

  it('erkennt gekaufte Fahrzeuge und gebaute Wachen', () => {
    const neu = createNeuesSpiel();
    const stand: ErsteSchritteStand = {
      ...neu,
      vehicles: [...neu.vehicles, { id: 'fahrzeug-2' }],
      locations: [...neu.locations, { type: 'station' }],
    };
    expect(erledigt(stand)).toEqual(['fahrzeug', 'wache']);
  });
});
