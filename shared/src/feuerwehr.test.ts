import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge, erstelleAlarmVorschlag, getPassendeVerfuegbareFahrzeuge, istFahrzeugVerfuegbar } from './alarmierung.js';
import { ALLE_EINSATZ_VORLAGEN, findeEinsatzVorlage, getEinsatzVersorgung } from './daten.js';
import { fahrzeugErfuelltBedarf } from './fahrzeuge.js';
import { berechneSpielTick } from './spielTick.js';
import { T0, einsatz, fahrzeug, wache } from './testHilfen.js';
import type { MapLocation } from './typen.js';

const feuerwache = wache('fw-1', 'Feuerwache');
/** Zweite Wache weiter weg (ca. 5 km) */
const fernWache: MapLocation = { ...wache('fw-2', 'Feuerwache'), coords: [48.73, 9.1771] };
const locations = [feuerwache, fernWache];

describe('Einsatzanforderungen (Daten)', () => {
  it('hat für die wichtigsten Stichworte einen klaren Bedarf', () => {
    const bedarf = (id: string) => findeEinsatzVorlage(id)!.requiredVehicles.map((b) => `${b.amount}× ${b.category}`);
    expect(bedarf('sturz')).toEqual(['1× RTW']);
    expect(bedarf('verkehrsunfall-rd')).toEqual(['2× RTW']);
    expect(bedarf('bewusstlose-person')).toEqual(['1× RTW', '1× NEF']);
    expect(bedarf('kleinbrand')).toEqual(['1× Löschfahrzeug']);
    expect(bedarf('zimmerbrand')).toEqual(['2× Löschfahrzeug', '1× Drehleiter']);
    expect(bedarf('gebaeudebrand')).toEqual(['3× Löschfahrzeug', '1× Drehleiter']);
    expect(bedarf('oelspur')).toEqual(['1× Technische Hilfe']);
  });

  it('schickt für jeden Patienten genug Transportfahrzeuge (RTW/KTW) mit', () => {
    const transportKlassen = ['RTW', 'KTW', 'Krankentransport'];
    for (const vorlage of ALLE_EINSATZ_VORLAGEN.filter((v) => v.patienten)) {
      const transport = vorlage.requiredVehicles
        .filter((b) => transportKlassen.includes(b.category))
        .reduce((summe, b) => summe + b.amount, 0);
      expect(transport, vorlage.id).toBeGreaterThanOrEqual(vorlage.patienten!.anzahl);
    }
    // Reine Rettungsdienst-Einsätze haben immer Patienten
    for (const vorlage of ALLE_EINSATZ_VORLAGEN.filter((v) => v.organization === 'Rettungsdienst')) {
      expect(vorlage.patienten, vorlage.id).toBeDefined();
    }
  });
});

describe('Feuerwehr – Einsatz erst mit ausreichend Kräften vor Ort', () => {
  it('B 2: ein LF vor Ort reicht nicht, die Bearbeitung beginnt erst mit dem zweiten', () => {
    const e = einsatz('garagenbrand');
    const vehicles = [fahrzeug('lf1', 'LF 10', 'fw-1'), fahrzeug('lf2', 'LF 20', 'fw-2')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['lf1', 'lf2'], T0);
    const [nah, fern] = start.incidents[0].alarmedVehicles.map((a) => a.arrivalAt);
    expect(nah).toBeLessThan(fern);

    const einsVorOrt = berechneSpielTick({ ...start, locations }, nah);
    expect(einsVorOrt.incidents[0].status).toBe('alarmiert');
    expect(einsVorOrt.vehicles.find((v) => v.id === 'lf1')?.status).toBe('Im Einsatz');
    // Alles alarmiert, aber noch nicht alles da → keine Nachforderung, nur „unterwegs“
    expect(einsVorOrt.incidents[0].meldungen.map((m) => m.art)).toEqual(['lage']);
    const versorgung = getEinsatzVersorgung(einsVorOrt.incidents[0], vehicles, nah);
    expect(versorgung.ausreichendAlarmiert).toBe(true);
    expect(versorgung.ausreichendVorOrt).toBe(false);
    expect(versorgung.fehlendVorOrt).toEqual([{ category: 'Löschfahrzeug', anzahl: 1 }]);

    const beideVorOrt = berechneSpielTick({ ...einsVorOrt, locations }, fern);
    expect(beideVorOrt.incidents[0].status).toBe('in_bearbeitung');
    expect(beideVorOrt.incidents[0].processingStartedAt).toBe(fern);
  });

  it('meldet „Kräfte reichen nicht aus“, wenn zu wenig alarmiert wurde, und wartet auf Nachalarmierung', () => {
    const e = einsatz('zimmerbrand');
    const vehicles = [fahrzeug('lf1', 'LF 10', 'fw-1'), fahrzeug('lf2', 'HLF 20', 'fw-1'), fahrzeug('dlk', 'DLK 23/12', 'fw-1')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['lf1'], T0);
    const spaeter = berechneSpielTick({ ...start, locations }, T0 + 60 * 60 * 1000);
    const lage = spaeter.incidents[0];
    expect(lage.status).toBe('alarmiert');
    expect(lage.neueMeldung).toBe(true);
    expect(lage.meldungen.find((m) => m.art === 'nachforderung')?.text).toBe('lf1: Kräfte reichen nicht aus – Nachforderung: 1× Löschfahrzeug, 1× Drehleiter.');

    const vorschlag = erstelleAlarmVorschlag(lage, { incidents: spaeter.incidents, vehicles: spaeter.vehicles, locations });
    expect(vorschlag.fahrzeugIds.sort()).toEqual(['dlk', 'lf2']);
    expect(vorschlag.nichtVerfuegbar).toEqual([]);
  });

  it('TH: TLF kann keine Technische Hilfe leisten', () => {
    const e = einsatz('oelspur');
    const vehicles = [fahrzeug('tlf', 'TLF 3000', 'fw-1'), fahrzeug('lf', 'LF 10', 'fw-2')];
    const passende = getPassendeVerfuegbareFahrzeuge(e, { incidents: [e], vehicles, locations });
    expect(passende.map((p) => p.vehicle.id)).toEqual(['lf']);
  });
});

describe('Alarmierungsvorschlag', () => {
  it('wählt die schnellsten freien Fahrzeuge passend zum Bedarf', () => {
    const e = einsatz('garagenbrand');
    const vehicles = [fahrzeug('fern', 'LF 10', 'fw-2'), fahrzeug('nah1', 'LF 20', 'fw-1'), fahrzeug('nah2', 'HLF 20', 'fw-1')];
    const vorschlag = erstelleAlarmVorschlag(e, { incidents: [e], vehicles, locations });
    expect(vorschlag.fahrzeugIds.sort()).toEqual(['nah1', 'nah2']);
  });

  it('berücksichtigt bereits alarmierte Fahrzeuge (Nachalarmierung)', () => {
    const e = einsatz('garagenbrand');
    const vehicles = [fahrzeug('lf1', 'LF 10', 'fw-1'), fahrzeug('lf2', 'LF 20', 'fw-1'), fahrzeug('lf3', 'LF 20', 'fw-2')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['lf1'], T0);
    const vorschlag = erstelleAlarmVorschlag(start.incidents[0], { ...start, locations });
    expect(vorschlag.fahrzeugIds).toEqual(['lf2']);
  });

  it('besetzt knappe Klassen zuerst (HLF fürs Rettungsgerät, TLF zum Löschen)', () => {
    const e = einsatz('vu-eingeklemmt');
    const vehicles = [
      fahrzeug('hlf', 'HLF 20', 'fw-1'),
      fahrzeug('tlf', 'TLF 3000', 'fw-1'),
      fahrzeug('rtw', 'RTW', 'fw-2'),
    ];
    const vorschlag = erstelleAlarmVorschlag(e, { incidents: [e], vehicles, locations });
    expect(vorschlag.fahrzeugIds.sort()).toEqual(['hlf', 'rtw', 'tlf']);
    expect(vorschlag.nichtVerfuegbar).toEqual([]);
  });

  it('eingeklemmte Person: ein normales LF hat kein Rettungsgerät – HLF oder Rüstwagen nötig', () => {
    const e = einsatz('vu-eingeklemmt');
    const vehicles = [fahrzeug('lf', 'LF 10', 'fw-1'), fahrzeug('lf2', 'LF 20', 'fw-1'), fahrzeug('rtw', 'RTW', 'fw-2')];
    const vorschlag = erstelleAlarmVorschlag(e, { incidents: [e], vehicles, locations });
    expect(vorschlag.nichtVerfuegbar).toEqual([{ category: 'Rettungsgerät', anzahl: 1 }]);
    expect(fahrzeugErfuelltBedarf('RW', 'Rettungsgerät')).toBe(true);
  });

  it('meldet, was mit freien Fahrzeugen nicht gedeckt werden kann', () => {
    const e = einsatz('zimmerbrand');
    const vehicles = [fahrzeug('lf1', 'LF 10', 'fw-1'), { ...fahrzeug('lf2', 'LF 20', 'fw-1'), status: 'Im Einsatz' as const }];
    const vorschlag = erstelleAlarmVorschlag(e, { incidents: [e], vehicles, locations });
    expect(vorschlag.fahrzeugIds).toEqual(['lf1']);
    expect(vorschlag.nichtVerfuegbar).toEqual([
      { category: 'Löschfahrzeug', anzahl: 1 },
      { category: 'Drehleiter', anzahl: 1 },
    ]);
  });

  it('schlägt nichts vor, solange der Einsatz bearbeitet wird', () => {
    const e = { ...einsatz('kleinbrand'), status: 'in_bearbeitung' as const };
    expect(erstelleAlarmVorschlag(e, { incidents: [e], vehicles: [fahrzeug('lf', 'LF 10', 'fw-1')], locations }).fahrzeugIds).toEqual([]);
  });

  it('lässt unterbesetzte Fahrzeuge aus', () => {
    const e = einsatz('kleinbrand');
    const unterbesetzt = { ...fahrzeug('lf', 'LF 10', 'fw-1'), besatzung: 4 };
    expect(istFahrzeugVerfuegbar(unterbesetzt, [e])).toBe(false);
    expect(erstelleAlarmVorschlag(e, { incidents: [e], vehicles: [unterbesetzt], locations }).fahrzeugIds).toEqual([]);
  });
});

describe('Freigabe überzähliger Fahrzeuge', () => {
  it('wartet nicht auf ein überzähliges Fahrzeug und schickt es beim Abschluss von seiner Position zurück', () => {
    const e = einsatz('kleinbrand');
    const vehicles = [fahrzeug('nah', 'LF 10', 'fw-1'), fahrzeug('fern', 'LF 10', 'fw-2')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['nah', 'fern'], T0);
    const [ankunftNah] = start.incidents[0].alarmedVehicles.map((a) => a.arrivalAt);

    const vorOrt = berechneSpielTick({ ...start, locations }, ankunftNah);
    expect(vorOrt.incidents[0].status).toBe('in_bearbeitung');
    const ende = vorOrt.incidents[0].processingEndsAt!;
    const fertig = berechneSpielTick({ ...vorOrt, locations }, ende);
    expect(fertig.abgeschlossen).toHaveLength(1);
    const fern = fertig.vehicles.find((v) => v.id === 'fern')!;
    expect(fern.status).toBe('Rückfahrt');
    // Kehrt um, wo es gerade war – nicht von der Einsatzstelle
    expect(fern.rueckfahrt!.von).not.toEqual(e.coords);
    expect(fern.rueckfahrt!.von[0]).toBeLessThan(e.coords[0]);
  });
});
