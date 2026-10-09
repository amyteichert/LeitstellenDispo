import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge } from './alarmierung.js';
import { getAvailableIncidentTemplates } from './einsatzErzeugung.js';
import { fahrzeugErfuelltBedarf, getFahrzeugTyp, getStartfahrzeugTypen, istAusreichendBesetzt } from './fahrzeuge.js';
import { hatEigenesKrankenhaus } from './krankenhaeuser.js';
import { getLehrgang } from './ausbildung.js';
import { synchronisiereBesatzung } from './personal.js';
import { berechneSpielTick, type SpielTickZustand } from './spielTick.js';
import { T0, eigenesKrankenhausWeitWeg, einsatz, fahrzeug, krankenhaus, wache } from './testHilfen.js';

const locations = [wache()];
const krankenhaeuser = [krankenhaus(), eigenesKrankenhausWeitWeg()];

/** Tickt so lange zum selben Zeitpunkt, bis sich nichts mehr ändert. */
const tickeBisRuhe = (zustand: SpielTickZustand, jetzt: number) => {
  let aktuell = zustand;
  for (let i = 0; i < 20; i += 1) {
    const ergebnis = berechneSpielTick(aktuell, jetzt);
    if (!ergebnis.geaendert) break;
    aktuell = { ...aktuell, vehicles: ergebnis.vehicles, incidents: ergebnis.incidents };
  }
  return aktuell;
};

describe('Sonderfahrzeuge KTW, RW und ELW 1', () => {
  it('gibt es nicht als Startfahrzeug', () => {
    expect(getStartfahrzeugTypen('Rettungswache').map((t) => t.typ)).toEqual(['RTW', 'NEF']);
    const fw = getStartfahrzeugTypen('Feuerwache').map((t) => t.typ);
    expect(fw).not.toContain('RW');
    expect(fw).not.toContain('ELW 1');
    expect(fw).toContain('HLF 20');
  });

  it('Krankentransport fährt der KTW oder ein RTW – aber nicht das NEF', () => {
    expect(fahrzeugErfuelltBedarf('KTW', 'Krankentransport')).toBe(true);
    expect(fahrzeugErfuelltBedarf('RTW', 'Krankentransport')).toBe(true);
    expect(fahrzeugErfuelltBedarf('NEF', 'Krankentransport')).toBe(false);
    // Ein KTW ersetzt keinen RTW im Notfall
    expect(fahrzeugErfuelltBedarf('KTW', 'RTW')).toBe(false);
  });

  it('Rüstwagen leistet Technische Hilfe, ein LF ersetzt aber keinen Rüstwagen', () => {
    expect(fahrzeugErfuelltBedarf('RW', 'Technische Hilfe')).toBe(true);
    expect(fahrzeugErfuelltBedarf('RW', 'Rüstwagen')).toBe(true);
    expect(fahrzeugErfuelltBedarf('HLF 20', 'Rüstwagen')).toBe(false);
    expect(fahrzeugErfuelltBedarf('ELW 1', 'Einsatzleitwagen')).toBe(true);
    expect(fahrzeugErfuelltBedarf('ELW 1', 'Löschfahrzeug')).toBe(false);
  });

  it('Krankentransporte gibt es erst mit eigenem Krankenhaus – dann auch nur mit einem RTW', () => {
    const rtw = [fahrzeug('rtw', 'RTW')];
    expect(getAvailableIncidentTemplates('Rettungswache', rtw).map((v) => v.id)).not.toContain('krankentransport');
    expect(getAvailableIncidentTemplates('Rettungswache', rtw, true).map((v) => v.id)).toContain('krankentransport');
    expect(getFahrzeugTyp('KTW')?.brauchtEigenesKrankenhaus).toBe(true);
    expect(hatEigenesKrankenhaus([krankenhaus()])).toBe(false);
    expect(hatEigenesKrankenhaus([krankenhaus(), { ...krankenhaus('eigen'), eigen: true }])).toBe(true);
  });

  it('Großeinsätze erst mit ELW', () => {
    const ohneElw = ['l1', 'l2', 'l3', 'l4', 'd1', 'd2'].map((id) => fahrzeug(id, id.startsWith('l') ? 'LF 20' : 'DLK 23/12'));
    expect(getAvailableIncidentTemplates('Feuerwache', ohneElw).map((v) => v.id)).not.toContain('grossbrand');
    const mitElw = [...ohneElw, fahrzeug('elw', 'ELW 1')];
    expect(getAvailableIncidentTemplates('Feuerwache', mitElw).map((v) => v.id)).toContain('grossbrand');
  });

  it('ELW 1 braucht einen Zugführer, den man als Gruppenführer ausbilden kann', () => {
    const elw = { ...fahrzeug('elw', 'ELW 1', 'fw-1') };
    const ohne = synchronisiereBesatzung([elw], [0, 1, 2].map((i) => ({ id: `p${i}`, name: 'X', wacheId: 'fw-1', qualifikationen: [], fahrzeugId: 'elw' })));
    expect(ohne[0].fehlendeQualifikation).toBe('zugfuehrer');
    expect(istAusreichendBesetzt(ohne[0])).toBe(false);
    expect(getLehrgang('zugfuehrer')?.voraussetzung).toBe('gruppenfuehrer');
  });

  it('KTW bringt einen leicht Verletzten ins Krankenhaus', () => {
    const e = einsatz('krankentransport', undefined, undefined, { transport: true });
    const fahrzeuge = [fahrzeug('ktw', 'KTW')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: fahrzeuge, locations }, e.id, ['ktw'], T0);
    const zustand = { ...start, locations, krankenhaeuser };
    const ankunft = start.incidents[0].alarmedVehicles[0].arrivalAt;
    const nachBehandlung = tickeBisRuhe(zustand, ankunft + e.durationSeconds * 1000);
    expect(nachBehandlung.incidents[0].status).toBe('transport');
    expect(nachBehandlung.incidents[0].patienten?.[0].transport?.fahrzeugId).toBe('ktw');
  });

  it('KTW transportiert keine Schwerverletzten – das macht der RTW, der KTW wird frei', () => {
    const e = einsatz('brustschmerzen', undefined, undefined, { transport: true });
    const fahrzeuge = [fahrzeug('ktw', 'KTW'), fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: fahrzeuge, locations }, e.id, ['ktw', 'rtw', 'nef'], T0);
    const zustand = { ...start, locations, krankenhaeuser };
    const spaeteste = Math.max(...start.incidents[0].alarmedVehicles.map((a) => a.arrivalAt));
    const danach = tickeBisRuhe(zustand, spaeteste + e.durationSeconds * 1000);
    expect(danach.incidents[0].patienten?.[0].transport?.fahrzeugId).toBe('rtw');
  });

  it('leicht Verletzte fahren lieber mit dem KTW, damit der RTW frei bleibt', () => {
    const e = einsatz('gestuerzte-person', undefined, undefined, { transport: true });
    const fahrzeuge = [fahrzeug('rtw', 'RTW'), fahrzeug('ktw', 'KTW')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: fahrzeuge, locations }, e.id, ['rtw', 'ktw'], T0);
    const zustand = { ...start, locations, krankenhaeuser };
    const spaeteste = Math.max(...start.incidents[0].alarmedVehicles.map((a) => a.arrivalAt));
    const danach = tickeBisRuhe(zustand, spaeteste + e.durationSeconds * 1000);
    expect(danach.incidents[0].patienten?.[0].transport?.fahrzeugId).toBe('ktw');
  });

  it('ohne eigenes Krankenhaus: kein Transport, Patient wird vor Ort entlassen und der RTW ist frei', () => {
    const e = einsatz('sturz', undefined, undefined, { transport: true });
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations }, e.id, ['rtw'], T0);
    const ankunft = start.incidents[0].alarmedVehicles[0].arrivalAt;
    const ende = ankunft + e.durationSeconds * 1000;
    let zustand: SpielTickZustand = { ...start, locations, krankenhaeuser: [krankenhaus()] };
    const abgeschlossen = [];
    for (const zeit of [ankunft, ende, ende]) {
      const ergebnis = berechneSpielTick(zustand, zeit);
      abgeschlossen.push(...ergebnis.abgeschlossen);
      zustand = { ...zustand, vehicles: ergebnis.vehicles, incidents: ergebnis.incidents };
    }
    expect(abgeschlossen).toHaveLength(1);
    expect(abgeschlossen[0].patienten?.[0].status).toBe('ambulant');
    expect(abgeschlossen[0].meldungen.some((m) => m.text.includes('am Einsatzort entlassen'))).toBe(true);
    expect(zustand.vehicles.find((v) => v.id === 'rtw')?.status).not.toBe('Patiententransport');
  });
});
