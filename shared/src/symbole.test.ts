import { describe, expect, it } from 'vitest';
import { ALLE_EINSATZ_VORLAGEN } from './daten.js';
import { getEinsatzSymbol } from './symbole.js';

const symbol = (stichwort: string, meldebild: string) => getEinsatzSymbol({ stichwort, meldebild });

describe('Einsatz-Symbole', () => {
  it('ordnet typische Einsätze dem passenden Symbol zu', () => {
    expect(symbol('B 2', 'Kellerbrand')).toBe('brand');
    expect(symbol('B 1', 'Brennender PKW')).toBe('brand');
    expect(symbol('B BMA', 'Brandmeldeanlage ausgelöst')).toBe('alarm');
    expect(symbol('B 1', 'Heimrauchmelder ausgelöst')).toBe('alarm');
    expect(symbol('RD 1', 'Gestürzte Person')).toBe('patient');
    expect(symbol('RD 2', 'Reanimation')).toBe('herz');
    expect(symbol('RD 2', 'Verkehrsunfall mit Verletzten')).toBe('verkehrsunfall');
    expect(symbol('TH 2', 'VU – Person eingeklemmt')).toBe('verkehrsunfall');
    expect(symbol('TH 2', 'LKW-Unfall, Fahrer eingeklemmt')).toBe('verkehrsunfall');
    expect(symbol('TH 2', 'Baum auf PKW, Person eingeklemmt')).toBe('baum');
    expect(symbol('TH 1', 'Ölspur')).toBe('wasser');
    expect(symbol('TH 1', 'Tier in Notlage')).toBe('tier');
    expect(symbol('TH 1', 'Person hinter verschlossener Tür')).toBe('tuer');
    expect(symbol('TH 1', 'Sturmschaden – lose Dachziegel')).toBe('technik');
    expect(symbol('KTP', 'Krankenhausverlegung')).toBe('krankentransport');
  });

  it('jede Einsatzvorlage bekommt ein Symbol, Feuerwehr-Brände nie ein Patienten-Symbol', () => {
    for (const vorlage of ALLE_EINSATZ_VORLAGEN) {
      const ergebnis = getEinsatzSymbol(vorlage);
      expect(ergebnis).toBeTruthy();
      if (vorlage.stichwort.startsWith('B ')) expect(ergebnis).not.toBe('patient');
    }
  });
});
