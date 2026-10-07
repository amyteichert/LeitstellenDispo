import { describe, expect, it } from 'vitest';
import {
  erzeugeAlarmDurchsage,
  erzeugeMeldungsFunk,
  erzeugeStatusFunk,
  getAngezeigterStatus,
  getMeldungKey,
  getOffeneSprechwuensche,
  getStatusStand,
  getVerborgeneMeldungen,
  quittiereSprechwunsch,
} from './funk.js';
import { T0, einsatz, fahrzeug } from './testHilfen.js';

const rtw = { ...fahrzeug('rtw', 'RTW'), callsign: 'RTW-1' };

describe('FMS-Status im Funk', () => {
  it('meldet Statuswechsel, nicht unveränderte Fahrzeuge', () => {
    const vorher = getStatusStand([rtw]);
    expect(erzeugeStatusFunk(vorher, [rtw], T0)).toEqual([]);
    const neu = erzeugeStatusFunk(vorher, [{ ...rtw, status: 'Im Einsatz' }], T0);
    expect(neu).toHaveLength(1);
    expect(neu[0]).toMatchObject({ von: 'RTW-1', an: 'Leitstelle', status: 4, text: 'Status 4 – Am Einsatzort' });
  });

  it('unbesetztes Fahrzeug an der Wache zeigt Status 6', () => {
    expect(getAngezeigterStatus({ ...rtw, besatzung: 0 })).toBe(6);
    expect(getAngezeigterStatus(rtw)).toBe(2);
  });
});

describe('Lagemeldungen und Sprechwunsch', () => {
  const e = { ...einsatz('sturz'), alarmedVehicles: [{ vehicleId: 'rtw', distanceKm: 1, etaSeconds: 60, arrivalAt: T0 }] };

  it('normale Lagemeldung kommt direkt als Funkspruch', () => {
    const spruch = erzeugeMeldungsFunk(e, { zeit: T0, text: 'RTW-1 vor Ort: Patient ansprechbar.', art: 'lage' }, [rtw]);
    expect(spruch).toMatchObject({ art: 'lage', von: 'RTW-1', text: 'RTW-1 für Leitstelle, kommen. Vor Ort: Patient ansprechbar.' });
  });

  it('Nachforderung kommt als Sprechwunsch, Inhalt erst nach der Sprechaufforderung', () => {
    const meldung = { zeit: T0, text: 'RTW-1: Notarzt erforderlich. Nachforderung: 1× NEF.', art: 'nachforderung' as const };
    const wunsch = erzeugeMeldungsFunk(e, meldung, [rtw]);
    expect(wunsch).toMatchObject({ art: 'sprechwunsch', status: 5, offen: true, inhalt: 'Notarzt erforderlich. Nachforderung: 1× NEF.' });
    expect(getVerborgeneMeldungen([wunsch]).has(getMeldungKey(e.id, meldung))).toBe(true);

    const funk = quittiereSprechwunsch([wunsch], wunsch.id, T0 + 5000);
    expect(getOffeneSprechwuensche(funk)).toHaveLength(0);
    expect(funk.slice(0, 2).map((s) => s.text)).toEqual([
      'RTW-1, Sprechaufforderung, kommen.',
      'Notarzt erforderlich. Nachforderung: 1× NEF.',
    ]);
    expect(getVerborgeneMeldungen(funk).size).toBe(0);
  });

  it('Eskalation ohne Funknamen: meldet sich das erste Fahrzeug vor Ort', () => {
    const spruch = erzeugeMeldungsFunk(e, { zeit: T0 + 1000, text: 'Patient nach dem Sturz bewusstlos.', art: 'eskalation' }, [rtw]);
    expect(spruch).toMatchObject({ art: 'sprechwunsch', von: 'RTW-1' });
  });

  it('Eskalation ohne Fahrzeug vor Ort ist eine normale Meldung', () => {
    const ohneAlarm = einsatz('sturz');
    const spruch = erzeugeMeldungsFunk(ohneAlarm, { zeit: T0, text: 'Patient nach dem Sturz bewusstlos.', art: 'eskalation' }, [rtw]);
    expect(spruch).toMatchObject({ art: 'lage', von: 'Einsatzstelle' });
  });
});

describe('Alarmdurchsage', () => {
  it('im Leitstellenstil', () => {
    const e = einsatz('sturz');
    expect(erzeugeAlarmDurchsage(e, [rtw], T0).text).toBe(`Alarm für RTW-1. RD 1 – Sturz, ${e.address}. Kommen.`);
  });
});
