import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge, istFahrzeugVerfuegbar } from './alarmierung.js';
import { getEinsatzVersorgung } from './daten.js';
import { getFahrzeugGeschwindigkeit } from './fahrzeuge.js';
import { getFahrzeitSekunden, getFahrzeugPosition } from './geo.js';
import { GAME_CONFIG } from './konfig.js';
import { berechneSpielTick, type SpielTickZustand } from './spielTick.js';
import { T0, eigenesKrankenhausWeitWeg, einsatz, fahrzeug, krankenhaus, wache } from './testHilfen.js';

const locations = [wache()];
const krankenhaeuser = [krankenhaus(), eigenesKrankenhausWeitWeg()];

/** Tickt so lange zum selben Zeitpunkt, bis sich nichts mehr ändert. */
const tickeBisRuhe = (zustand: SpielTickZustand, jetzt: number) => {
  let aktuell = zustand;
  const abgeschlossen = [];
  for (let i = 0; i < 20; i += 1) {
    const ergebnis = berechneSpielTick(aktuell, jetzt);
    abgeschlossen.push(...ergebnis.abgeschlossen);
    if (!ergebnis.geaendert) break;
    aktuell = { ...aktuell, vehicles: ergebnis.vehicles, incidents: ergebnis.incidents };
  }
  return { ...aktuell, abgeschlossen };
};

const starteRd = (vorlageId: string, fahrzeuge = [fahrzeug('rtw', 'RTW')], alarmiert = ['rtw'], transport = true) => {
  const e = einsatz(vorlageId, undefined, undefined, { transport });
  const start = alarmiereFahrzeuge({ incidents: [e], vehicles: fahrzeuge, locations }, e.id, alarmiert, T0);
  return { ...start, locations, krankenhaeuser };
};

describe('Rettungsdienst – Patient, Transport und Krankenhaus', () => {
  it('RD 1 – Sturz: Behandlung → Transport → Übergabe → RTW frei → Einsatz abgeschlossen', () => {
    const zustand = starteRd('sturz');
    const e0 = zustand.incidents[0];
    expect(e0.patienten).toHaveLength(1);
    expect(e0.patienten![0].status).toBe('wartet');
    const ankunft = e0.alarmedVehicles[0].arrivalAt;

    // Eintreffen: Lagemeldung + Behandlung beginnt
    const vorOrt = berechneSpielTick(zustand, ankunft);
    const e1 = vorOrt.incidents[0];
    expect(e1.status).toBe('in_bearbeitung');
    expect(e1.patienten![0].status).toBe('in_behandlung');
    expect(e1.meldungen[0]).toMatchObject({ zeit: ankunft, art: 'lage' });
    expect(e1.meldungen[0].text).toContain('rtw vor Ort');

    // Behandlung beendet: Transport ins Krankenhaus
    const behandlungsEnde = e1.processingEndsAt!;
    const transport = berechneSpielTick({ ...zustand, ...vorOrt }, behandlungsEnde);
    const e2 = transport.incidents[0];
    expect(e2.status).toBe('transport');
    const t = e2.patienten![0].transport!;
    expect(t).toMatchObject({ fahrzeugId: 'rtw', krankenhausId: 'kh-1', startAt: behandlungsEnde });
    expect(t.ankunftAt).toBe(behandlungsEnde + getFahrzeitSekunden(e2.coords, krankenhaeuser[0].coords, getFahrzeugGeschwindigkeit('RTW')) * 1000);
    expect(t.uebergabeBis).toBe(t.ankunftAt + GAME_CONFIG.patientenUebergabeSekunden * 1000);
    expect(transport.abgeschlossen).toHaveLength(0);
    // Transporte werden vergütet
    expect(e2.reward).toBe(e0.reward + GAME_CONFIG.transportVerguetung);

    // Unterwegs ins Krankenhaus: Status 7, sichtbar auf der Karte, nicht alarmierbar
    const unterwegs = berechneSpielTick({ ...zustand, ...transport }, behandlungsEnde + 1000);
    expect(unterwegs.vehicles[0].status).toBe('Patiententransport');
    expect(istFahrzeugVerfuegbar(unterwegs.vehicles[0], unterwegs.incidents)).toBe(false);
    const mitte = getFahrzeugPosition(unterwegs.vehicles[0], unterwegs.incidents, locations, (t.startAt + t.ankunftAt) / 2)!;
    expect(mitte.art).toBe('transport');
    expect(mitte.ziel).toEqual(krankenhaeuser[0].coords);
    expect(mitte.position[0]).toBeCloseTo((e2.coords[0] + krankenhaeuser[0].coords[0]) / 2, 6);

    // Am Krankenhaus (Status 8)
    const amKh = berechneSpielTick({ ...zustand, ...unterwegs }, t.ankunftAt);
    expect(amKh.vehicles[0].status).toBe('Am Krankenhaus');
    expect(amKh.incidents[0].patienten![0].status).toBe('uebergabe');

    // Übergabe fertig: Einsatz abgeschlossen, RTW fährt vom Krankenhaus zurück
    const fertig = berechneSpielTick({ ...zustand, ...amKh }, t.uebergabeBis);
    expect(fertig.incidents).toHaveLength(0);
    expect(fertig.abgeschlossen).toHaveLength(1);
    expect(fertig.abgeschlossen[0].completedAt).toBe(t.uebergabeBis);
    expect(fertig.abgeschlossen[0].patienten![0].status).toBe('uebergeben');
    expect(fertig.abgeschlossen[0].meldungen.at(-1)?.text).toContain('übergeben');
    expect(fertig.vehicles[0].status).toBe('Rückfahrt');
    expect(fertig.vehicles[0].rueckfahrt).toMatchObject({ von: krankenhaeuser[0].coords, startAt: t.uebergabeBis });
    // Auf der Rückfahrt darf der RTW direkt von unterwegs neu alarmiert werden
    expect(istFahrzeugVerfuegbar(fertig.vehicles[0], fertig.incidents)).toBe(true);

    // Erst an der Wache wieder einsatzbereit
    const zurueck = berechneSpielTick({ ...zustand, vehicles: fertig.vehicles, incidents: [] }, fertig.vehicles[0].rueckfahrt!.ankunftAt);
    expect(zurueck.vehicles[0].status).toBe('Einsatzbereit');
    expect(istFahrzeugVerfuegbar(zurueck.vehicles[0], [])).toBe(true);
  });

  it('schließt ohne Transport direkt nach der Behandlung ab (Patient ambulant versorgt)', () => {
    const zustand = starteRd('schnittverletzung', undefined, undefined, false);
    const ergebnis = tickeBisRuhe(zustand, T0 + 60 * 60 * 1000);
    expect(ergebnis.abgeschlossen).toHaveLength(1);
    const fertig = ergebnis.abgeschlossen[0];
    expect(fertig.patienten![0].status).toBe('ambulant');
    expect(fertig.completedAt).toBe(fertig.processingEndsAt);
    expect(fertig.reward).toBe(zustand.incidents[0].reward);
  });

  it('holt die ganze Kette offline nach – mit den echten Zeitpunkten', () => {
    const zustand = starteRd('sturz');
    const ergebnis = tickeBisRuhe(zustand, T0 + 60 * 60 * 1000);
    expect(ergebnis.abgeschlossen).toHaveLength(1);
    const fertig = ergebnis.abgeschlossen[0];
    const t = fertig.patienten![0].transport!;
    expect(t.startAt).toBe(fertig.processingEndsAt);
    expect(fertig.completedAt).toBe(t.uebergabeBis);
    expect(ergebnis.vehicles[0].status).toBe('Einsatzbereit');
    expect(fertig.meldungen.map((m) => m.zeit)).toEqual([...fertig.meldungen.map((m) => m.zeit)].sort((a, b) => a - b));
  });

  it('versorgt mehrere Patienten mit mehreren RTW (RD 2 – Verkehrsunfall)', () => {
    const fahrzeuge = [fahrzeug('rtw1', 'RTW'), fahrzeug('rtw2', 'RTW')];
    const zustand = starteRd('verkehrsunfall-rd', fahrzeuge, ['rtw1', 'rtw2']);
    expect(zustand.incidents[0].patienten).toHaveLength(2);

    const ankunft = Math.max(...zustand.incidents[0].alarmedVehicles.map((a) => a.arrivalAt));
    const ende = berechneSpielTick(zustand, ankunft).incidents[0].processingEndsAt!;
    const transport = tickeBisRuhe(zustand, ende);
    const fahrzeugeImTransport = transport.incidents[0].patienten!.map((p) => p.transport?.fahrzeugId).sort();
    expect(fahrzeugeImTransport).toEqual(['rtw1', 'rtw2']);
  });

  it('übergibt Patienten vor Ort, wenn kein Krankenhaus existiert', () => {
    const zustand = { ...starteRd('sturz'), krankenhaeuser: [] };
    const ergebnis = tickeBisRuhe(zustand, T0 + 60 * 60 * 1000);
    expect(ergebnis.abgeschlossen[0].patienten![0].status).toBe('ambulant');
  });

  it('fährt nur aufnahmebereite Krankenhäuser an – das nächste zuerst', () => {
    const fern = { ...krankenhaus('kh-fern'), coords: [48.9, 9.1771] as [number, number] };
    const zustand = { ...starteRd('sturz'), krankenhaeuser: [{ ...krankenhaus('kh-voll', false), coords: [48.785, 9.1771] as [number, number] }, fern, krankenhaus(), eigenesKrankenhausWeitWeg()] };
    const ergebnis = tickeBisRuhe(zustand, T0 + 60 * 60 * 1000);
    expect(ergebnis.abgeschlossen[0].patienten![0].transport?.krankenhausId).toBe('kh-1');
  });
});

describe('Rettungsdienst – NEF / Notarzt', () => {
  it('RD 2: RTW allein reicht nicht – Nachforderung, keine Behandlung bis das NEF da ist', () => {
    const fahrzeuge = [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')];
    const zustand = starteRd('bewusstlose-person', fahrzeuge, ['rtw']);
    const ankunftRtw = zustand.incidents[0].alarmedVehicles[0].arrivalAt;

    const nurRtw = berechneSpielTick(zustand, ankunftRtw + 30_000);
    const e = nurRtw.incidents[0];
    expect(e.status).toBe('alarmiert');
    expect(e.patienten![0].status).toBe('wartet');
    expect(e.neueMeldung).toBe(true);
    expect(e.meldungen.find((m) => m.art === 'nachforderung')?.text).toContain('1× NEF');
    expect(getEinsatzVersorgung(e, fahrzeuge, ankunftRtw + 30_000).fehlendAlarmiert).toEqual([{ category: 'NEF', anzahl: 1 }]);

    // NEF nachalarmieren → Behandlung beginnt bei Ankunft des NEF
    const nach = alarmiereFahrzeuge({ incidents: nurRtw.incidents, vehicles: nurRtw.vehicles, locations }, e.id, ['nef'], ankunftRtw + 30_000);
    const ankunftNef = nach.incidents[0].alarmedVehicles[1].arrivalAt;
    const mitNef = berechneSpielTick({ ...zustand, ...nach }, ankunftNef);
    expect(mitNef.incidents[0].status).toBe('in_bearbeitung');
    expect(mitNef.incidents[0].processingStartedAt).toBe(ankunftNef);

    // Nach der Behandlung: NEF frei (Rückfahrt), RTW transportiert
    const ende = mitNef.incidents[0].processingEndsAt!;
    const danach = berechneSpielTick({ ...zustand, ...mitNef }, ende);
    expect(danach.incidents[0].status).toBe('transport');
    expect(danach.vehicles.find((v) => v.id === 'nef')?.status).toBe('Rückfahrt');
    expect(danach.vehicles.find((v) => v.id === 'nef')?.rueckfahrt?.von).toEqual(danach.incidents[0].coords);
    expect(danach.incidents[0].alarmedVehicles.find((a) => a.vehicleId === 'nef')?.freigegebenAt).toBe(ende);
  });

  it('fordert bei Eintreffen einen Notarzt nach (ausgewürfelte Nachforderung)', () => {
    const e = einsatz('sturz', undefined, undefined, { nachforderung: true });
    const fahrzeuge = [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: fahrzeuge, locations }, e.id, ['rtw'], T0);
    const ankunft = start.incidents[0].alarmedVehicles[0].arrivalAt;
    const ergebnis = berechneSpielTick({ ...start, locations, krankenhaeuser }, ankunft);
    const nachher = ergebnis.incidents[0];
    expect(nachher.requiredVehicles.map((b) => [b.category, b.amount])).toEqual([['RTW', 1], ['NEF', 1]]);
    expect(nachher.reward).toBe(e.reward + 120);
    expect(nachher.status).toBe('alarmiert');
    expect(nachher.meldungen.map((m) => m.art)).toEqual(['lage', 'nachforderung']);
  });

  it('fordert keinen Notarzt nach, den der Spieler gar nicht besitzt', () => {
    const e = einsatz('sturz', undefined, undefined, { nachforderung: true });
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations }, e.id, ['rtw'], T0);
    const ergebnis = berechneSpielTick({ ...start, locations, krankenhaeuser }, start.incidents[0].alarmedVehicles[0].arrivalAt);
    expect(ergebnis.incidents[0].requiredVehicles).toHaveLength(1);
    expect(ergebnis.incidents[0].status).toBe('in_bearbeitung');
  });
});
