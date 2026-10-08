import { describe, expect, it } from 'vitest';
import {
  deutscheZeit,
  einsatzIntervallMs,
  entstehtEinsatz,
  maxOffeneEinsaetze,
  tageszeitFaktor,
  vorlagenGewicht,
  waehleGewichtet,
  wetterAusMessung,
  type AufkommenKontext,
} from './aufkommen.js';

const kontext = (teil: Partial<AufkommenKontext> = {}): AufkommenKontext => ({ stunde: 12, wochentag: 3, wachen: 1, wetter: 'klar', ...teil });

describe('Einsatzaufkommen', () => {
  it('nutzt die deutsche Uhrzeit', () => {
    // 2026-10-08 (Donnerstag) 01:30 UTC = 03:30 Sommerzeit
    expect(deutscheZeit(Date.UTC(2026, 9, 8, 1, 30))).toEqual({ stunde: 3, wochentag: 4 });
  });

  it('nachts halb so viel, im Berufsverkehr mehr, am Wochenende kein Berufsverkehr', () => {
    expect(tageszeitFaktor({ stunde: 3, wochentag: 3 })).toBe(0.5);
    expect(tageszeitFaktor({ stunde: 17, wochentag: 3 })).toBe(1.3);
    expect(tageszeitFaktor({ stunde: 17, wochentag: 6 })).toBe(1);
    expect(tageszeitFaktor({ stunde: 2, wochentag: 6 })).toBe(0.75);
  });

  it('mehr Wachen und schlechtes Wetter verkürzen den Abstand, gedeckelt', () => {
    const basis = einsatzIntervallMs(kontext());
    expect(einsatzIntervallMs(kontext({ wachen: 3 }))).toBeLessThan(basis);
    expect(einsatzIntervallMs(kontext({ wetter: 'glaette' }))).toBeLessThan(basis);
    expect(einsatzIntervallMs(kontext({ wachen: 100 }))).toBeCloseTo(basis / 3);
    expect(maxOffeneEinsaetze(1)).toBe(4);
    expect(maxOffeneEinsaetze(50)).toBe(12);
  });

  it('Art passt zur Lage: Glätte = Unfälle, Sturm = Bäume, Hitze = Kreislauf', () => {
    expect(vorlagenGewicht('verkehrsunfall-rd', kontext({ wetter: 'glaette' }))).toBeGreaterThan(2);
    expect(vorlagenGewicht('baum-auf-strasse', kontext({ wetter: 'sturm' }))).toBe(5);
    expect(vorlagenGewicht('kreislaufprobleme', kontext({ wetter: 'hitze' }))).toBe(2.5);
    expect(vorlagenGewicht('sturz', kontext())).toBe(1);
    const vorlagen = [{ id: 'sturz' }, { id: 'baum-auf-strasse' }];
    expect(waehleGewichtet(vorlagen, kontext({ wetter: 'sturm' }), 0.5).id).toBe('baum-auf-strasse');
  });

  it('Zufall trifft den Durchschnitt', () => {
    expect(entstehtEinsatz(1000, 20000, 0.01)).toBe(true);
    expect(entstehtEinsatz(1000, 20000, 0.5)).toBe(false);
  });

  it('übersetzt Messwerte ins Spielwetter', () => {
    expect(wetterAusMessung(0, 31, 10)).toBe('hitze');
    expect(wetterAusMessung(63, 12, 20)).toBe('regen');
    expect(wetterAusMessung(61, 0, 10)).toBe('glaette');
    expect(wetterAusMessung(3, 15, 75)).toBe('sturm');
    expect(wetterAusMessung(2, 15, 10)).toBe('klar');
  });
});
