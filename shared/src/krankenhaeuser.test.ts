import { describe, expect, it } from 'vitest';
import {
  EIGENES_KRANKENHAUS,
  findeZielKrankenhaus,
  nimmPatientAuf,
  nimmtAuf,
  pruefeFachrichtung,
  pruefeKrankenhausBau,
  type Krankenhaus,
  KRANKENHAUS_RUF,
  getBetten,
  getKrankenhausRuf,
  getPflegekraefte,
  getNotaufnahmePlaetze,
  getStationFuer,
  getStationsBetten,
  getStationsPflegekraefte,
  istNotaufnahmeVoll,
  mitFachrichtung,
  mitNotaufnahmePlatz,
  NOTAUFNAHME,
  getVerguetungJePatient,
  mitKrankenhausRuf,
  mitNeuerPflegekraft,
  mitNotaufnahme,
  pruefePflegekraft,
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
    // 1 Pflegekraft = 2 Betten
    let eigen = kh('eigen', 48.02, { eigen: true, stationen: { innere: 1 } });
    expect(findeZielKrankenhaus([48, 9], [fremd, eigen], undefined, T)?.id).toBe('eigen');
    eigen = nimmPatientAuf(nimmPatientAuf(eigen, T), T);
    expect(nimmtAuf(eigen, T + 1000)).toBe(false);
    expect(findeZielKrankenhaus([48, 9], [fremd, eigen], undefined, T + 1000)?.id).toBe('fremd');
    expect(nimmtAuf(eigen, T + EIGENES_KRANKENHAUS.liegedauerMs + 1)).toBe(true);
  });

  it('Bau und Fachrichtungen brauchen Wachen, Ruf und Geld', () => {
    expect(pruefeKrankenhausBau(2, 90, 9e6)).toMatch(/3 Rettungswachen/);
    expect(pruefeKrankenhausBau(3, 40, 9e6)).toMatch(/Ruf/);
    expect(pruefeKrankenhausBau(3, 60, 1000)).toMatch(/Guthaben/);
    expect(pruefeKrankenhausBau(3, 60, 9e6)).toBeNull();
    const eigen = kh('e', 48, { eigen: true });
    expect(pruefeFachrichtung(eigen, 'neurologie', 70, 9e6)).toMatch(/Ruf 80/);
    expect(pruefeFachrichtung(eigen, 'kardiologie', 70, 9e6)).toBeNull();
    expect(pruefeFachrichtung(eigen, 'innere', 70, 9e6)).toMatch(/Schon/);
  });
});

describe('Krankenhaus-Ruf, Pflegepersonal und Notaufnahme', () => {
  it('jede Station hat eigene Pflegekräfte und Betten; alte Spielstände werden verteilt', () => {
    const neu = kh('n', 48, { eigen: true, stationen: { innere: 5 } });
    expect(getStationsBetten(neu, 'innere')).toBe(10);
    expect(getStationsBetten(neu, 'kardiologie')).toBe(0);
    expect(getStationsBetten(mitNeuerPflegekraft(neu, 'innere'), 'innere')).toBe(12);
    // Neue Fachabteilung bringt eine eigene kleine Station mit
    const mitHerz = mitFachrichtung(neu, 'kardiologie');
    expect(getStationsBetten(mitHerz, 'kardiologie')).toBe(EIGENES_KRANKENHAUS.startPflegekraefteJeStation * 2);
    expect(getBetten(mitHerz)).toBe(10 + EIGENES_KRANKENHAUS.startPflegekraefteJeStation * 2);
    // Alter Stand: 20 gekaufte Betten = 10 Pflegekräfte, gleichmäßig auf Innere und Herz verteilt
    const alt = kh('alt', 48, { eigen: true, kapazitaet: 20, fachbereiche: ['innere', 'kardiologie'] });
    expect(getPflegekraefte(alt)).toBe(10);
    expect(getStationsPflegekraefte(alt, 'kardiologie')).toBe(5);
    const voll = kh('v', 48, { eigen: true, stationen: { innere: 15 } });
    expect(pruefePflegekraft(voll, 'innere', 9e6)).toMatch(/30 Betten/);
    expect(pruefePflegekraft(neu, 'innere', 100)).toMatch(/Guthaben/);
  });

  it('Patient braucht ein Bett auf seiner Station und einen Platz in der Notaufnahme', () => {
    let haus = kh('s', 48, { eigen: true, fachbereiche: ['innere', 'kardiologie'], stationen: { innere: 5, kardiologie: 1 } });
    // Herz-Station hat 2 Betten
    haus = nimmPatientAuf(nimmPatientAuf(haus, T, 'kardiologie'), T, 'kardiologie');
    expect(nimmtAuf(haus, T, 'kardiologie')).toBe(false);
    expect(nimmtAuf(haus, T, 'innere')).toBe(true);
    // Unfallpatient ohne Unfallchirurgie landet auf der Inneren
    expect(getStationFuer(haus, 'unfallchirurgie')).toBe('innere');
    // Notaufnahme (4 Plätze) voll → nimmt niemanden mehr auf, nach 30 Min. wieder frei
    haus = nimmPatientAuf(nimmPatientAuf(haus, T), T);
    expect(istNotaufnahmeVoll(haus, T)).toBe(true);
    expect(nimmtAuf(haus, T, 'innere')).toBe(false);
    expect(nimmtAuf(haus, T + NOTAUFNAHME.verweildauerMs + 1, 'innere')).toBe(true);
    expect(getNotaufnahmePlaetze(mitNotaufnahmePlatz(haus))).toBe(NOTAUFNAHME.startPlaetze + 1);
  });

  it('Ruf steigt bei passender Fachabteilung, sinkt bei fehlender – und bestimmt die Vergütung', () => {
    let haus = kh('r', 48, { eigen: true, fachbereiche: ['innere', 'kardiologie'] });
    expect(getKrankenhausRuf(haus)).toBe(KRANKENHAUS_RUF.start);
    haus = nimmPatientAuf(haus, T, 'kardiologie');
    expect(getKrankenhausRuf(haus)).toBe(51);
    haus = nimmPatientAuf(haus, T, 'neurologie');
    expect(getKrankenhausRuf(haus)).toBe(49);
    // Ohne Fachbedarf ändert sich nichts
    expect(getKrankenhausRuf(nimmPatientAuf(haus, T))).toBe(49);
    expect(getVerguetungJePatient({ ruf: 50 })).toBe(EIGENES_KRANKENHAUS.verguetungJePatient);
    expect(getVerguetungJePatient({ ruf: 100 })).toBe(Math.round(EIGENES_KRANKENHAUS.verguetungJePatient * 1.5));
    expect(getVerguetungJePatient({ ruf: 0 })).toBe(Math.round(EIGENES_KRANKENHAUS.verguetungJePatient * 0.5));
    expect(getKrankenhausRuf(mitKrankenhausRuf(haus, 500))).toBe(100);
  });

  it('Notaufnahme abmelden: nimmt nicht mehr auf, kostet Ruf; Anmelden kostet nichts', () => {
    const haus = kh('a', 48, { eigen: true });
    const abgemeldet = mitNotaufnahme(haus, false, T);
    expect(nimmtAuf(abgemeldet, T)).toBe(false);
    expect(abgemeldet.abgemeldetSeit).toBe(T);
    expect(getKrankenhausRuf(abgemeldet)).toBe(KRANKENHAUS_RUF.start + KRANKENHAUS_RUF.abmeldung);
    const wieder = mitNotaufnahme(abgemeldet, true, T + 1);
    expect(nimmtAuf(wieder, T + 1)).toBe(true);
    expect(getKrankenhausRuf(wieder)).toBe(getKrankenhausRuf(abgemeldet));
    // Doppelt abmelden kostet nicht doppelt
    expect(mitNotaufnahme(abgemeldet, false, T + 2)).toBe(abgemeldet);
  });
});
