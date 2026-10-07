import { describe, expect, it } from 'vitest';
import {
  getNaechsterRaumPreis,
  getRaumPlaetze,
  getRaumUpgradePreis,
  mitNeuemRaum,
  mitRaumUpgrade,
  schliesseLehrgaengeAb,
  starteLehrgang,
} from './ausbildung.js';
import { besetzeAutomatisch, synchronisiereBesatzung, type Mitarbeiter } from './personal.js';
import { T0, fahrzeug, wache } from './testHilfen.js';

const TAG = 24 * 60 * 60 * 1000;
const person = (id: string, qualifikationen: Mitarbeiter['qualifikationen'] = [], fahrzeugId?: string): Mitarbeiter => ({
  id, name: id, wacheId: 'rw-1', qualifikationen, fahrzeugId,
});
const rwMitRaum = () => mitNeuemRaum(wache('rw-1'));

describe('Ausbildungsbereich und Räume', () => {
  it('Bereich 40.000 €, weitere Räume ab 50.000 €, höchstens 4', () => {
    let rw = wache('rw-1');
    expect(getNaechsterRaumPreis(rw)).toBe(40000);
    rw = mitNeuemRaum(rw);
    expect(getNaechsterRaumPreis(rw)).toBe(50000);
    rw = mitNeuemRaum(rw);
    expect(getNaechsterRaumPreis(rw)).toBe(80000);
    rw = mitNeuemRaum(rw);
    expect(getNaechsterRaumPreis(rw)).toBe(128000);
    rw = mitNeuemRaum(rw);
    expect(getNaechsterRaumPreis(rw)).toBeNull();
  });

  it('Raum startet mit 4 Plätzen, jedes Upgrade +2, höchstens 3 Upgrades', () => {
    let rw = rwMitRaum();
    const raum = () => rw.ausbildungsRaeume![0];
    expect(getRaumPlaetze(raum())).toBe(4);
    expect(getRaumUpgradePreis(raum())).toBe(15000);
    rw = mitRaumUpgrade(rw, 'raum-1');
    expect(getRaumPlaetze(raum())).toBe(6);
    rw = mitRaumUpgrade(mitRaumUpgrade(rw, 'raum-1'), 'raum-1');
    expect(getRaumUpgradePreis(raum())).toBeNull();
  });
});

describe('Lehrgang', () => {
  it('Teilnehmer verlassen ihr Fahrzeug, kosten je Person und bekommen am Ende die Qualifikation', () => {
    const rtw = fahrzeug('rtw', 'RTW');
    const personal = [person('a', ['notfallsanitaeter'], 'rtw'), person('b', [], 'rtw')];
    const start = starteLehrgang({ wache: rwMitRaum(), raumId: 'raum-1', qualifikation: 'notfallsanitaeter', teilnehmerIds: ['b'], personal, jetzt: T0 });
    if ('fehler' in start) throw new Error(start.fehler);

    expect(start.kosten).toBe(2000);
    expect(start.personal.find((p) => p.id === 'b')).toMatchObject({ fahrzeugId: undefined, inAusbildungBis: T0 + 3 * TAG });
    // RTW fehlt jetzt eine Person
    expect(synchronisiereBesatzung([rtw], start.personal)[0].besatzung).toBe(1);
    // Wer im Lehrgang ist, wird nicht automatisch eingeteilt
    expect(besetzeAutomatisch(rtw, start.personal).find((p) => p.id === 'b')?.fahrzeugId).toBeUndefined();

    const zuFrueh = schliesseLehrgaengeAb([start.wache], start.personal, T0 + TAG);
    expect(zuFrueh.abgeschlossen).toHaveLength(0);

    const fertig = schliesseLehrgaengeAb([start.wache], start.personal, T0 + 3 * TAG);
    expect(fertig.abgeschlossen).toEqual([{ wacheId: 'rw-1', wacheName: 'Wache rw-1', qualifikation: 'notfallsanitaeter', namen: ['b'] }]);
    const b = fertig.personal.find((p) => p.id === 'b')!;
    expect(b.qualifikationen).toEqual(['notfallsanitaeter']);
    expect(b.inAusbildungBis).toBeUndefined();
    expect(fertig.locations[0].ausbildungsRaeume![0].lehrgang).toBeUndefined();
  });

  it('Notarzt nur mit Notfallsanitäter, Raum nur einmal belegt, Plätze begrenzt', () => {
    const personal = ['a', 'b', 'c', 'd', 'e'].map((id) => person(id, ['notfallsanitaeter']));
    const ohneNfs = starteLehrgang({ wache: rwMitRaum(), raumId: 'raum-1', qualifikation: 'notarzt', teilnehmerIds: ['x'], personal: [person('x')], jetzt: T0 });
    expect(ohneNfs).toEqual({ fehler: 'x erfüllt die Voraussetzung nicht.' });

    const zuViele = starteLehrgang({ wache: rwMitRaum(), raumId: 'raum-1', qualifikation: 'notarzt', teilnehmerIds: ['a', 'b', 'c', 'd', 'e'], personal, jetzt: T0 });
    expect(zuViele).toEqual({ fehler: 'Der Raum hat nur 4 Plätze.' });

    const erster = starteLehrgang({ wache: rwMitRaum(), raumId: 'raum-1', qualifikation: 'notarzt', teilnehmerIds: ['a'], personal, jetzt: T0 });
    if ('fehler' in erster) throw new Error(erster.fehler);
    const zweiter = starteLehrgang({ wache: erster.wache, raumId: 'raum-1', qualifikation: 'notarzt', teilnehmerIds: ['b'], personal: erster.personal, jetzt: T0 });
    expect(zweiter).toEqual({ fehler: 'In diesem Raum läuft bereits ein Lehrgang.' });
  });

  it('Feuerwehr-Lehrgänge gibt es nicht an der Rettungswache', () => {
    const ergebnis = starteLehrgang({ wache: rwMitRaum(), raumId: 'raum-1', qualifikation: 'gruppenfuehrer', teilnehmerIds: ['a'], personal: [person('a')], jetzt: T0 });
    expect(ergebnis).toEqual({ fehler: 'Dieser Lehrgang ist an dieser Wache nicht möglich.' });
  });
});
