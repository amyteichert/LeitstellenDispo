import { describe, expect, it } from 'vitest';
import {
  EIGENES_KRANKENHAUS,
  findeZielKrankenhaus,
  nimmPatientAuf,
  nimmtAuf,
  pruefeFachrichtung,
  pruefeKrankenhausBau,
  type Krankenhaus,
} from './krankenhaeuser.js';

const T = 1_800_000_000_000;
const kh = (id: string, lat: number, extra: Partial<Krankenhaus> = {}): Krankenhaus => ({
  id, name: id, adresse: { strasse: 'X', plz: '1', ort: 'Y' }, coords: [lat, 9], aufnahme: true, ...extra,
});

describe('Fachrichtungen und eigene Krankenhäuser', () => {
  it('fährt mit Herzinfarkt ins nächste Haus mit Herzkatheter, sonst ins nächste', () => {
    const nah = kh('nah', 48.01);
    const herz = kh('herz', 48.1, { fachbereiche: ['innere', 'kardiologie'] });
    expect(findeZielKrankenhaus([48, 9], [nah, herz], 'kardiologie', T)?.id).toBe('herz');
    expect(findeZielKrankenhaus([48, 9], [nah, herz], 'unfallchirurgie', T)?.id).toBe('nah');
    const weit = kh('weit', 49, { fachbereiche: ['kardiologie'] });
    expect(findeZielKrankenhaus([48, 9], [nah, weit], 'kardiologie', T)?.id).toBe('nah');
  });

  it('eigenes Haus wird leicht bevorzugt und meldet sich ab, wenn die Betten voll sind', () => {
    const fremd = kh('fremd', 48.01);
    let eigen = kh('eigen', 48.02, { eigen: true, kapazitaet: 1 });
    expect(findeZielKrankenhaus([48, 9], [fremd, eigen], undefined, T)?.id).toBe('eigen');
    eigen = nimmPatientAuf(eigen, T);
    expect(nimmtAuf(eigen, T + 1000)).toBe(false);
    expect(findeZielKrankenhaus([48, 9], [fremd, eigen], undefined, T + 1000)?.id).toBe('fremd');
    expect(nimmtAuf(eigen, T + EIGENES_KRANKENHAUS.liegedauerMs + 1)).toBe(true);
  });

  it('Bau und Fachrichtungen brauchen Wachen, Ruf und Geld', () => {
    expect(pruefeKrankenhausBau(2, 90, 9e6)).toMatch(/3 Wachen/);
    expect(pruefeKrankenhausBau(3, 40, 9e6)).toMatch(/Ruf/);
    expect(pruefeKrankenhausBau(3, 60, 1000)).toMatch(/Guthaben/);
    expect(pruefeKrankenhausBau(3, 60, 9e6)).toBeNull();
    const eigen = kh('e', 48, { eigen: true });
    expect(pruefeFachrichtung(eigen, 'neurologie', 70, 9e6)).toMatch(/Ruf 80/);
    expect(pruefeFachrichtung(eigen, 'kardiologie', 70, 9e6)).toBeNull();
    expect(pruefeFachrichtung(eigen, 'innere', 70, 9e6)).toMatch(/Schon/);
  });
});
