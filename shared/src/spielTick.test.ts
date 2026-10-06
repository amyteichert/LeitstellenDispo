import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge } from './alarmierung.js';
import { berechneSpielTick } from './spielTick.js';
import { T0, einsatz, fahrzeug, wache } from './testHilfen.js';

const locations = [wache()];

describe('berechneSpielTick – Einsatzablauf', () => {
  it('führt einen Einsatz von der Alarmierung bis zur Rückkehr an die Wache', () => {
    const e = einsatz('sturz');
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations }, e.id, ['rtw'], T0);
    expect(start.incidents[0].status).toBe('alarmiert');
    const ankunft = start.incidents[0].alarmedVehicles[0].arrivalAt;
    expect(ankunft).toBeGreaterThan(T0);

    // Unterwegs: noch nichts passiert
    const unterwegs = berechneSpielTick({ ...start, locations }, T0 + 1000);
    expect(unterwegs.incidents[0].status).toBe('alarmiert');

    // Ankunft: Bearbeitung beginnt genau zur Ankunftszeit
    const angekommen = berechneSpielTick({ ...unterwegs, locations }, ankunft);
    expect(angekommen.incidents[0].status).toBe('in_bearbeitung');
    expect(angekommen.incidents[0].processingStartedAt).toBe(ankunft);
    expect(angekommen.vehicles[0].status).toBe('Im Einsatz');

    // Ende der Bearbeitung: abgeschlossen, Belohnung, Rückfahrt
    const ende = angekommen.incidents[0].processingEndsAt!;
    const fertig = berechneSpielTick({ ...angekommen, locations }, ende);
    expect(fertig.incidents).toHaveLength(0);
    expect(fertig.abgeschlossen).toHaveLength(1);
    expect(fertig.abgeschlossen[0].reward).toBe(220);
    expect(fertig.abgeschlossen[0].completedAt).toBe(ende);
    expect(fertig.vehicles[0].status).toBe('Rückfahrt');
    expect(fertig.vehicles[0].rueckfahrt?.startAt).toBe(ende);

    // An der Wache wieder einsatzbereit
    const zurueck = berechneSpielTick({ ...fertig, locations }, fertig.vehicles[0].rueckfahrt!.ankunftAt);
    expect(zurueck.vehicles[0].status).toBe('Einsatzbereit');
    expect(zurueck.vehicles[0].rueckfahrt).toBeUndefined();
  });

  it('holt verpasste Zeit nach, wenn das Spiel lange geschlossen war', () => {
    const e = einsatz('sturz');
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations }, e.id, ['rtw'], T0);
    const ankunft = start.incidents[0].alarmedVehicles[0].arrivalAt;

    // Eine Stunde später: ein einziger Tick schließt den Einsatz mit den echten Zeitpunkten ab
    const spaeter = berechneSpielTick({ ...start, locations }, T0 + 60 * 60 * 1000);
    expect(spaeter.abgeschlossen).toHaveLength(1);
    expect(spaeter.abgeschlossen[0].processingStartedAt).toBe(ankunft);
    expect(spaeter.abgeschlossen[0].completedAt).toBe(ankunft + spaeter.abgeschlossen[0].durationSeconds * 1000);

    // Die Rückfahrt ist ebenfalls längst vorbei
    const danach = berechneSpielTick({ ...spaeter, locations }, T0 + 60 * 60 * 1000);
    expect(danach.vehicles[0].status).toBe('Einsatzbereit');
  });

  it('beginnt die Bearbeitung erst, wenn alle benötigten Fahrzeuge da sind', () => {
    const e = einsatz('reanimation');
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')], locations }, e.id, ['rtw'], T0);
    const spaeter = berechneSpielTick({ ...start, locations }, T0 + 60 * 60 * 1000);
    expect(spaeter.incidents[0].status).toBe('alarmiert');
    expect(spaeter.abgeschlossen).toHaveLength(0);
  });

  it('meldet keine Änderung, wenn nichts passiert', () => {
    const vehicles = [fahrzeug('rtw', 'RTW')];
    const incidents = [einsatz('sturz')];
    const ergebnis = berechneSpielTick({ vehicles, incidents, locations }, T0);
    expect(ergebnis.geaendert).toBe(false);
    expect(ergebnis.vehicles).toBe(vehicles);
    expect(ergebnis.incidents).toBe(incidents);
  });
});

describe('berechneSpielTick – Eskalation', () => {
  const alarmiertesRd1 = (vehicles = [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')]) => {
    const e = einsatz('kreislaufprobleme', 0.5);
    return alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['rtw'], T0);
  };

  it('eskaliert während der Bearbeitung in den größeren Einsatz', () => {
    const start = alarmiertesRd1();
    const ankunft = start.incidents[0].alarmedVehicles[0].arrivalAt;
    const inBearbeitung = berechneSpielTick({ ...start, locations }, ankunft);
    const dauer = inBearbeitung.incidents[0].durationSeconds * 1000;
    const eskalationsZeit = ankunft + 0.5 * dauer;

    const eskaliert = berechneSpielTick({ ...inBearbeitung, locations }, eskalationsZeit);
    const e = eskaliert.incidents[0];
    expect(e.stichwort).toBe('RD 2');
    expect(e.vorlageId).toBe('reanimation');
    expect(e.status).toBe('alarmiert');
    expect(e.reward).toBe(450);
    expect(e.neueMeldung).toBe(true);
    expect(e.meldungen).toHaveLength(1);
    expect(e.meldungen[0].zeit).toBe(eskalationsZeit);
    expect(e.processingStartedAt).toBeUndefined();
    // Der RTW bleibt am Einsatz, es fehlt nur der NEF
    expect(e.alarmedVehicles.map((a) => a.vehicleId)).toEqual(['rtw']);
  });

  it('eskaliert nicht, wenn der Spieler den größeren Einsatz nicht schaffen kann', () => {
    const start = alarmiertesRd1([fahrzeug('rtw', 'RTW')]); // kein NEF vorhanden
    const spaeter = berechneSpielTick({ ...start, locations }, T0 + 60 * 60 * 1000);
    expect(spaeter.abgeschlossen).toHaveLength(1);
    expect(spaeter.abgeschlossen[0].stichwort).toBe('RD 1');
  });
});
