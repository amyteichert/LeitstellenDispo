import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge } from './alarmierung.js';
import { eskaliereEinsatz, findeEinsatzVorlage, fuegeMeldungenHinzu, istEskaliert, istWichtigeMeldung } from './daten.js';
import { berechneSpielTick } from './spielTick.js';
import { T0, einsatz, fahrzeug, krankenhaus, wache } from './testHilfen.js';

describe('Lagemeldungen', () => {
  it('bleiben zeitlich sortiert, auch wenn Meldungen nachträglich (offline) eintreffen', () => {
    const meldungen = fuegeMeldungenHinzu([{ zeit: 300, text: 'c', art: 'patient' }], [
      { zeit: 100, text: 'a', art: 'lage' },
      { zeit: 200, text: 'b', art: 'nachforderung' },
    ]);
    expect(meldungen.map((m) => m.text)).toEqual(['a', 'b', 'c']);
  });

  it('unterscheiden wichtige Meldungen (Hinweis + Gong) von Statusmeldungen', () => {
    expect(istWichtigeMeldung({ zeit: 0, text: '', art: 'eskalation' })).toBe(true);
    expect(istWichtigeMeldung({ zeit: 0, text: '', art: 'nachforderung' })).toBe(true);
    expect(istWichtigeMeldung({ zeit: 0, text: '' })).toBe(true); // alte Spielstände: immer Eskalation
    expect(istWichtigeMeldung({ zeit: 0, text: '', art: 'lage' })).toBe(false);
    expect(istWichtigeMeldung({ zeit: 0, text: '', art: 'patient' })).toBe(false);
  });

  it('markieren einen Einsatz auf der Karte nur bei echter Eskalation als eskaliert', () => {
    const e = einsatz('sturz');
    expect(istEskaliert({ meldungen: [{ zeit: 1, text: 'RTW vor Ort', art: 'lage' }] })).toBe(false);
    expect(istEskaliert(eskaliereEinsatz(e, findeEinsatzVorlage('bewusstlose-person')!, 'bewusstlos', T0))).toBe(true);
  });

  it('kommen beim Eintreffen mit Zeitstempel der Ankunft und Funkrufname', () => {
    const e = einsatz('kleinbrand');
    const locations = [wache('rw-1', 'Feuerwache')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('LF10-1', 'LF 10')], locations }, e.id, ['LF10-1'], T0);
    const ankunft = start.incidents[0].alarmedVehicles[0].arrivalAt;
    const ergebnis = berechneSpielTick({ ...start, locations }, ankunft + 5000);
    expect(ergebnis.incidents[0].meldungen).toEqual([
      { zeit: ankunft, art: 'lage', text: 'LF10-1 vor Ort: Kleinbrand im Hinterhof, Löschangriff mit einem C-Rohr.' },
    ]);
    // Statusmeldung → kein „neue Meldung“-Alarm
    expect(ergebnis.incidents[0].neueMeldung).toBeFalsy();
  });
});

describe('Eskalation im Rettungsdienst', () => {
  it('verschlechtert den Patientenzustand und macht einen Transport nötig', () => {
    const e = einsatz('sturz', 0.5, undefined, { transport: false });
    const locations = [wache()];
    const vehicles = [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['rtw'], T0);
    const ankunft = start.incidents[0].alarmedVehicles[0].arrivalAt;
    const zustand = { ...start, locations, krankenhaeuser: [krankenhaus()] };
    const inBehandlung = berechneSpielTick(zustand, ankunft);
    const eskalation = ankunft + 0.5 * inBehandlung.incidents[0].durationSeconds * 1000;
    const eskaliert = berechneSpielTick({ ...zustand, ...inBehandlung }, eskalation).incidents[0];

    expect(eskaliert.meldebild).toBe('Bewusstlose Person');
    expect(eskaliert.patienten).toHaveLength(1);
    expect(eskaliert.patienten![0]).toMatchObject({ zustand: 'schwer', transportErforderlich: true, status: 'wartet' });
    expect(eskaliert.meldungen.at(-1)).toMatchObject({ art: 'nachforderung', text: 'Nachforderung: 1× NEF.' });
  });
});
