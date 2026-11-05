import { describe, expect, it } from 'vitest';
import { erzeugeMitAbstand, liegtZuNahAnEinsatz, type EinsatzErzeugungErgebnis } from './einsatzErzeugung.js';
import type { Koordinaten } from './typen.js';

const offen = (coords: Koordinaten) => ({ coords, status: 'offen' as const });
const ergebnisBei = (coords: Koordinaten) => ({ einsatz: { coords } }) as unknown as EinsatzErzeugungErgebnis;

describe('Abstand neuer Einsätze', () => {
  it('erkennt Einsätze direkt neben einem offenen Einsatz, abgeschlossene zählen nicht', () => {
    expect(liegtZuNahAnEinsatz([48.775, 9.185], [offen([48.7751, 9.1851])])).toBe(true);
    expect(liegtZuNahAnEinsatz([48.775, 9.185], [offen([48.79, 9.185])])).toBe(false);
    expect(liegtZuNahAnEinsatz([48.775, 9.185], [{ coords: [48.775, 9.185], status: 'abgeschlossen' }])).toBe(false);
  });

  it('würfelt neu, bis der Einsatz frei liegt', () => {
    const orte: Koordinaten[] = [[48.775, 9.185], [48.7752, 9.1852], [48.79, 9.2]];
    let i = 0;
    const ergebnis = erzeugeMitAbstand([offen([48.775, 9.185])], () => ergebnisBei(orte[i++]));
    expect(ergebnis).toMatchObject({ einsatz: { coords: [48.79, 9.2] } });
    expect(i).toBe(3);
  });

  it('gibt nach den Versuchen auf und nimmt den letzten', () => {
    let i = 0;
    const ergebnis = erzeugeMitAbstand([offen([48.775, 9.185])], () => { i += 1; return ergebnisBei([48.775, 9.185]); }, 4);
    expect('einsatz' in ergebnis).toBe(true);
    expect(i).toBe(4);
  });
});
