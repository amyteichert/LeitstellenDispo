import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge } from './alarmierung.js';
import { erzeugeDruckEinsatz, erzeugeZufallsEinsatz, getDruckVorlagen, istVorlageKaufbar } from './einsatzErzeugung.js';
import { findeEinsatzVorlage, istVorlageErfuellbar } from './daten.js';
import { EINSATZDRUCK_CONFIG } from './konfig.js';
import { berechneSpielTick } from './spielTick.js';
import { T0, einsatz, fahrzeug, wache } from './testHilfen.js';

const nurRtw = [fahrzeug('rtw', 'RTW')];

describe('Einsatzdruck – Einsätze, für die noch Fahrzeuge fehlen', () => {
  it('kommen nur für Fahrzeuge, die man an den eigenen Wachenarten kaufen kann', () => {
    const brustschmerzen = findeEinsatzVorlage('brustschmerzen')!;
    expect(istVorlageKaufbar(brustschmerzen, ['Rettungswache'])).toBe(true);
    // Feuerwehr-Einsatz mit RTW: nur, wenn es auch eine Rettungswache gibt
    const vu = findeEinsatzVorlage('vu-eingeklemmt')!;
    expect(istVorlageKaufbar(vu, ['Feuerwache'])).toBe(false);
    expect(istVorlageKaufbar(vu, ['Feuerwache', 'Rettungswache'])).toBe(true);
  });

  it('nur RTW: RD 2 mit NEF wird zum Druck-Einsatz, schaffbare und Krankentransporte nicht', () => {
    const ids = getDruckVorlagen('Rettungswache', nurRtw, ['Rettungswache']).map((v) => v.id);
    expect(ids).toContain('brustschmerzen');
    expect(ids).not.toContain('kreislaufprobleme');
    expect(ids).not.toContain('krankentransport');
    expect(ids).not.toContain('verlegung');
  });

  it('erzeugt einen Druck-Einsatz mit Markierung und früherem Verfall', () => {
    const e = erzeugeDruckEinsatz([wache()], nurRtw, T0)!;
    expect(e.fehlendeKraefte).toBe(true);
    expect(e.verfallAt).toBe(T0 + EINSATZDRUCK_CONFIG.verfallNachMs);
    // Mit dem einen RTW ist er nicht zu schaffen (z. B. NEF fehlt oder 2 RTW nötig)
    expect(istVorlageErfuellbar(e, ['RTW'])).toBe(false);
  });

  it(`gibt es erst ab ${EINSATZDRUCK_CONFIG.abWachen} Wachen`, () => {
    const wenige = Array.from({ length: EINSATZDRUCK_CONFIG.abWachen - 1 }, (_, i) => wache(`rw-${i}`));
    for (let i = 0; i < 200; i += 1) {
      const ergebnis = erzeugeZufallsEinsatz(wenige, nurRtw, T0);
      if (!('einsatz' in ergebnis)) throw new Error('Einsatz erwartet');
      expect(ergebnis.einsatz.fehlendeKraefte).toBeUndefined();
    }
    const viele = Array.from({ length: EINSATZDRUCK_CONFIG.abWachen }, (_, i) => wache(`rw-${i}`));
    const druck = Array.from({ length: 300 }, () => erzeugeZufallsEinsatz(viele, nurRtw, T0))
      .filter((ergebnis) => 'einsatz' in ergebnis && ergebnis.einsatz.fehlendeKraefte);
    expect(druck.length).toBeGreaterThan(0);
  });

  it('verfällt unbearbeitet nach der kürzeren Zeit', () => {
    const e = erzeugeDruckEinsatz([wache()], nurRtw, T0)!;
    const zustand = { vehicles: nurRtw, incidents: [e], locations: [wache()] };
    expect(berechneSpielTick(zustand, e.verfallAt! - 1000).incidents).toHaveLength(1);
    const danach = berechneSpielTick(zustand, e.verfallAt!);
    expect(danach.incidents).toHaveLength(0);
    expect(danach.verfallen).toHaveLength(1);
  });
});

describe('An die Nachbarleitstelle abgeben', () => {
  it('entfernt den Einsatz ohne Vergütung und lässt alarmierte Fahrzeuge einrücken', () => {
    const e = einsatz('brustschmerzen');
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: nurRtw, locations: [wache()] }, e.id, ['rtw'], T0);
    const abgegeben = { ...start.incidents[0], abgegebenAt: T0 + 5000 };
    const ergebnis = berechneSpielTick({ vehicles: start.vehicles, incidents: [abgegeben], locations: [wache()] }, T0 + 5000);
    expect(ergebnis.incidents).toHaveLength(0);
    expect(ergebnis.abgeschlossen).toHaveLength(0);
    expect(ergebnis.verfallen).toHaveLength(1);
    expect(ergebnis.vehicles.find((v) => v.id === 'rtw')?.status).toBe('Rückfahrt');
  });
});
