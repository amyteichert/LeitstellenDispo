import { describe, expect, it } from 'vitest';
import { istFahrzeugVerfuegbar } from './alarmierung.js';
import { istAusreichendBesetzt } from './fahrzeuge.js';
import {
  besetzeAutomatisch,
  erzeugeBesatzungFuer,
  erzeugeBewerber,
  getEinstellungsPreis,
  getPersonalLimit,
  getRuheraumPreis,
  mitRuheraumAusbau,
  synchronisiereBesatzung,
  type Mitarbeiter,
} from './personal.js';
import { createNeuesSpiel, migriereSpielstand } from './spielstand.js';
import { fahrzeug, wache } from './testHilfen.js';

const person = (id: string, qualifikationen: Mitarbeiter['qualifikationen'] = [], fahrzeugId?: string): Mitarbeiter => ({
  id, name: id, wacheId: 'rw-1', qualifikationen, fahrzeugId,
});

describe('Besatzung aus dem Personal', () => {
  it('RTW ohne Notfallsanitäter ist nicht alarmierbar, mit schon', () => {
    const rtw = fahrzeug('rtw', 'RTW');
    const ohne = synchronisiereBesatzung([rtw], [person('a', [], 'rtw'), person('b', [], 'rtw')])[0];
    expect(ohne).toMatchObject({ besatzung: 2, fehlendeQualifikation: 'notfallsanitaeter' });
    expect(istAusreichendBesetzt(ohne)).toBe(false);
    expect(istFahrzeugVerfuegbar(ohne, [])).toBe(false);

    const mit = synchronisiereBesatzung([rtw], [person('a', ['notfallsanitaeter'], 'rtw'), person('b', [], 'rtw')])[0];
    expect(mit.fehlendeQualifikation).toBeUndefined();
    expect(istFahrzeugVerfuegbar(mit, [])).toBe(true);
  });

  it('neu gekauftes Fahrzeug ohne Personal ist nicht besetzt', () => {
    const [lf] = synchronisiereBesatzung([fahrzeug('lf', 'LF 10', 'fw-1')], []);
    expect(lf.besatzung).toBe(0);
    expect(istAusreichendBesetzt(lf)).toBe(false);
  });

  it('gibt dasselbe Array zurück, wenn sich nichts ändert', () => {
    const vehicles = synchronisiereBesatzung([fahrzeug('rtw', 'RTW')], [person('a', ['notfallsanitaeter'], 'rtw'), person('b', [], 'rtw')]);
    expect(synchronisiereBesatzung(vehicles, [person('a', ['notfallsanitaeter'], 'rtw'), person('b', [], 'rtw')])).toBe(vehicles);
  });
});

describe('Automatisch besetzen', () => {
  it('nimmt zuerst die Pflicht-Qualifikation und schont Spezialisten', () => {
    const nef = fahrzeug('nef', 'NEF');
    const personal = [person('notarzt', ['notarzt']), person('nfs', ['notfallsanitaeter']), person('helfer')];
    const ergebnis = besetzeAutomatisch(nef, personal);
    const besatzung = ergebnis.filter((p) => p.fahrzeugId === 'nef').map((p) => p.id).sort();
    expect(besatzung).toEqual(['helfer', 'notarzt']);
  });

  it('tauscht bei voller Besatzung eine Person gegen die fehlende Qualifikation', () => {
    const rtw = fahrzeug('rtw', 'RTW');
    const personal = [person('a', [], 'rtw'), person('b', [], 'rtw'), person('nfs', ['notfallsanitaeter'])];
    const ergebnis = besetzeAutomatisch(rtw, personal);
    expect(ergebnis.filter((p) => p.fahrzeugId === 'rtw')).toHaveLength(2);
    expect(ergebnis.find((p) => p.id === 'nfs')?.fahrzeugId).toBe('rtw');
    expect(synchronisiereBesatzung([rtw], ergebnis)[0].fehlendeQualifikation).toBeUndefined();
  });

  it('nutzt nur Personal der eigenen Wache', () => {
    const rtw = fahrzeug('rtw', 'RTW');
    const fremd = { ...person('fremd', ['notfallsanitaeter']), wacheId: 'rw-2' };
    expect(besetzeAutomatisch(rtw, [fremd])[0].fahrzeugId).toBeUndefined();
  });
});

describe('Einstellen und Limit', () => {
  it('Preis steigt mit Qualifikation', () => {
    expect(getEinstellungsPreis([])).toBe(1500);
    expect(getEinstellungsPreis(['notarzt'])).toBe(5500);
  });

  it('Bewerber passen zur Wachenart', () => {
    const qualis = erzeugeBewerber(wache('fw-1', 'Feuerwache'), 50).flatMap((b) => b.qualifikationen);
    expect(qualis.every((q) => ['gruppenfuehrer', 'maschinist_dlk', 'zugfuehrer'].includes(q))).toBe(true);
  });

  it('Ruheräume erhöhen das Personal-Limit', () => {
    let rw = wache('rw-1');
    expect(getPersonalLimit(rw)).toBe(6);
    expect(getRuheraumPreis(rw)).toBe(15000);
    rw = mitRuheraumAusbau(rw);
    expect(getPersonalLimit(rw)).toBe(9);
    expect(getPersonalLimit(wache('fw-1', 'Feuerwache'))).toBe(12);
  });
});

describe('Spielstand mit Personal', () => {
  it('Startfahrzeug einer Wache wird voll besetzt, inkl. Notfallsanitäter', () => {
    const besatzung = erzeugeBesatzungFuer(fahrzeug('rtw', 'RTW'));
    expect(besatzung).toHaveLength(2);
    expect(besatzung.some((p) => p.qualifikationen.includes('notfallsanitaeter'))).toBe(true);
    expect(istAusreichendBesetzt(synchronisiereBesatzung([fahrzeug('rtw', 'RTW')], besatzung)[0])).toBe(true);
  });

  it('alter Spielstand ohne Personal: alle Fahrzeuge werden voll besetzt', () => {
    const { personal: _p, ...alt } = createNeuesSpiel();
    const altMitLf = { ...alt, vehicles: [fahrzeug('rtw', 'RTW', 'rettungswache-zentrum'), fahrzeug('lf', 'LF 10', 'rettungswache-zentrum')] };
    const geladen = migriereSpielstand(altMitLf)!;
    expect(geladen.personal).toHaveLength(2 + 9);
    expect(geladen.vehicles.every(istAusreichendBesetzt)).toBe(true);
  });

  it('erzeugt keine Besatzung für Fahrzeuge ohne Wache', () => {
    expect(erzeugeBesatzungFuer(fahrzeug('x', 'RTW', null))).toEqual([]);
  });
});
