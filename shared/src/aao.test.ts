import { describe, expect, it } from 'vitest';
import { AAO_KATEGORIE, ladeAao, waehleAaoFahrzeuge, type AaoEintrag } from './aao.js';
import { fahrzeug } from './testHilfen.js';

const eintrag = (id: string, type: string, anfahrtSekunden: number, stationId = 'fw-1') =>
  ({ vehicle: fahrzeug(id, type, stationId), anfahrtSekunden });
const aao = (teil: Partial<AaoEintrag>): AaoEintrag =>
  ({ id: 'a', name: 'Test', farbe: '#ff0000', reiter: 'Feuerwehr', fahrzeuge: {}, wachen: [], ...teil });

describe('AAO', () => {
  const frei = [
    eintrag('lf-weit', 'LF 20', 900),
    eintrag('hlf', 'HLF 20', 200),
    eintrag('lf', 'LF 10', 300),
    eintrag('dlk', 'DLK 23/12', 400),
    eintrag('rtw', 'RTW', 100, 'rw-1'),
  ];

  it('Löschzug: schnellste Fahrzeuge je Kategorie, fehlender ELW wird gemeldet', () => {
    const loeschzug = aao({ fahrzeuge: {
      [`${AAO_KATEGORIE}Einsatzleitwagen`]: 1, [`${AAO_KATEGORIE}Löschfahrzeug`]: 2, [`${AAO_KATEGORIE}Drehleiter`]: 1,
    } });
    const ergebnis = waehleAaoFahrzeuge(loeschzug, frei);
    expect(ergebnis.fahrzeugIds).toEqual(['hlf', 'lf', 'dlk']);
    expect(ergebnis.fehlt).toEqual(['1× Einsatzleitwagen (beliebig)']);
  });

  it('fester Typ vor beliebiger Kategorie, damit der Typ nicht verbraucht wird', () => {
    const ergebnis = waehleAaoFahrzeuge(aao({ fahrzeuge: { [`${AAO_KATEGORIE}Löschfahrzeug`]: 1, 'HLF 20': 1 } }), frei);
    expect(ergebnis.fahrzeugIds).toEqual(['hlf', 'lf']);
    expect(ergebnis.fehlt).toEqual([]);
  });

  it('ganze Wache: alle freien Fahrzeuge der Wache', () => {
    expect(waehleAaoFahrzeuge(aao({ wachen: ['rw-1'] }), frei).fahrzeugIds).toEqual(['rtw']);
  });

  it('zweiter Klick wählt weitere Fahrzeuge dazu', () => {
    const lf = aao({ fahrzeuge: { [`${AAO_KATEGORIE}Löschfahrzeug`]: 1 } });
    expect(waehleAaoFahrzeuge(lf, frei, ['hlf']).fahrzeugIds).toEqual(['lf']);
  });

  it('ohne AAO gibt es keine Knöpfe, unveränderte frühere Startknöpfe fallen weg', () => {
    expect(ladeAao(undefined)).toEqual([]);
    const start = { id: 'aao-rtw', name: 'RTW', farbe: '#ca8a04', reiter: 'Rettungsdienst', wachen: [], fahrzeuge: { RTW: 1 } };
    const eigener = { ...start, name: 'Mein RTW' };
    expect(ladeAao([start, eigener])).toEqual([eigener]);
  });
});
