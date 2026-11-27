import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge } from './alarmierung.js';
import {
  darfGrosslageEntstehen,
  erzeugeGrosslage,
  findeGrosslagenVorlage,
  getGrosslagenStaende,
  getMachbareGrosslagen,
  GROSSLAGEN_VORLAGEN,
} from './grosslagen.js';
import { findeEinsatzVorlage } from './einsatzVorlagen.js';
import { berechneSpielTick } from './spielTick.js';
import { pruefeLaufbahn } from './plausibilitaet.js';
import { ERFOLGE, LAUFBAHN_START, RAENGE } from './laufbahn.js';
import { T0, fahrzeug, wache } from './testHilfen.js';
import type { SpielEinsatz } from './daten.js';
import type { Vehicle } from './typen.js';

const locations = [wache('fw-1', 'Feuerwache'), wache('rw-1', 'Rettungswache')];
const fw = (id: string, typ: string) => fahrzeug(id, typ, 'fw-1');
const rd = (id: string, typ: string) => fahrzeug(id, typ, 'rw-1');

/** Genug für die Unwetterlage: TH, RW+LF+RTW, DLK+LF, LF */
const sturmFahrzeuge = (): Vehicle[] => [
  fw('hlf', 'HLF 20'), fw('rw', 'RW'), fw('lf1', 'LF 20'), fw('dlk', 'DLK 23/12'), fw('lf2', 'LF 20'), fw('lf3', 'LF 10'),
  rd('rtw', 'RTW'),
];

/** Fester Zufall, damit Ort und Adresse in jedem Lauf gleich sind */
const zufall = () => 0.3;

const abschnitt = (incidents: SpielEinsatz[], vorlageId: string) => {
  const gefunden = incidents.find((einsatz) => einsatz.vorlageId === vorlageId);
  if (!gefunden) throw new Error(`Abschnitt ${vorlageId} fehlt`);
  return gefunden;
};

describe('Großschadenslagen – Vorlagen', () => {
  it('jeder Abschnitt ist als Einsatzvorlage auffindbar und jede Lage hat zwei Wellen', () => {
    for (const lage of GROSSLAGEN_VORLAGEN) {
      expect(lage.abschnitte.some((a) => a.welle === 1)).toBe(true);
      expect(lage.abschnitte.some((a) => a.welle === 2)).toBe(true);
      for (const a of lage.abschnitte) {
        expect(a.vorlage.id.startsWith('gl-')).toBe(true);
        expect(findeEinsatzVorlage(a.vorlage.id)).toBe(a.vorlage);
      }
    }
    const ids = GROSSLAGEN_VORLAGEN.flatMap((lage) => lage.abschnitte.map((a) => a.vorlage.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('nur Lagen, deren Abschnitte alle mit den eigenen Fahrzeugen machbar sind', () => {
    expect(getMachbareGrosslagen([rd('rtw', 'RTW')])).toHaveLength(0);
    expect(getMachbareGrosslagen(sturmFahrzeuge()).map((lage) => lage.id)).toEqual(['unwetter-sturm']);
    // Fahrzeuge ohne Wache zählen nicht
    expect(getMachbareGrosslagen(sturmFahrzeuge().map((v) => ({ ...v, stationId: undefined })))).toHaveLength(0);
  });

  it('entsteht erst ab Rang, Wachenzahl und wenn keine andere Lage läuft', () => {
    const abXp = RAENGE.find((rang) => rang.stufe === 4)!.abXp;
    expect(darfGrosslageEntstehen(abXp - 1, 5, [])).toBe(false);
    expect(darfGrosslageEntstehen(abXp, 2, [])).toBe(false);
    expect(darfGrosslageEntstehen(abXp, 3, [])).toBe(true);
    const lage = erzeugeGrosslage(locations, sturmFahrzeuge(), T0, zufall)!;
    expect(darfGrosslageEntstehen(abXp, 3, lage)).toBe(false);
  });
});

describe('Großschadenslagen – Ablauf', () => {
  it('erste Welle entsteht sofort, zuständig ist die passende Wache', () => {
    const lage = erzeugeGrosslage(locations, sturmFahrzeuge(), T0, zufall, 'unwetter-sturm')!;
    expect(lage.map((e) => e.vorlageId).sort()).toEqual(['gl-sturm-baum', 'gl-sturm-pkw']);
    expect(new Set(lage.map((e) => e.grosslage!.id)).size).toBe(1);
    expect(lage.every((e) => e.generatedByStationId === 'fw-1')).toBe(true);
    // Abschnitte liegen nicht aufeinander
    expect(lage[0].coords).not.toEqual(lage[1].coords);
    const [stand] = getGrosslagenStaende(lage);
    expect(stand).toMatchObject({ name: 'Unwetterlage – Orkanböen', offen: 2, gesamt: 4, erkundungAusstehend: true });
  });

  it('Erkundung löst Welle 2 aus, nach dem letzten Abschnitt gibt es den Abschlussbonus', () => {
    let zustand = { incidents: erzeugeGrosslage(locations, sturmFahrzeuge(), T0, zufall, 'unwetter-sturm')!, vehicles: sturmFahrzeuge(), locations };
    zustand = { ...zustand, ...alarmiereFahrzeuge(zustand, abschnitt(zustand.incidents, 'gl-sturm-baum').id, ['hlf'], T0) };
    zustand = { ...zustand, ...alarmiereFahrzeuge(zustand, abschnitt(zustand.incidents, 'gl-sturm-pkw').id, ['rw', 'lf1', 'rtw'], T0) };

    // Viel später: Welle 1 ist fertig, Welle 2 ist bei der ersten Ankunft entstanden
    const tick1 = berechneSpielTick(zustand, T0 + 60 * 60_000);
    expect(tick1.abgeschlossen).toHaveLength(2);
    expect(tick1.grosslagenNeu?.map((e) => e.vorlageId).sort()).toEqual(['gl-sturm-dach', 'gl-sturm-keller']);
    expect(tick1.incidents).toHaveLength(2);
    expect(tick1.grosslagenBeendet).toBeUndefined();
    const ersteAnkunft = Math.min(...tick1.abgeschlossen.map((e) => e.erstesEintreffenAt!));
    expect(tick1.incidents.every((e) => e.createdAt === ersteAnkunft && e.grosslage?.welle2)).toBe(true);

    // Welle 2 abarbeiten
    zustand = { ...zustand, incidents: tick1.incidents, vehicles: tick1.vehicles };
    const jetzt = T0 + 61 * 60_000;
    zustand = { ...zustand, ...alarmiereFahrzeuge(zustand, abschnitt(zustand.incidents, 'gl-sturm-dach').id, ['dlk', 'lf2'], jetzt) };
    zustand = { ...zustand, ...alarmiereFahrzeuge(zustand, abschnitt(zustand.incidents, 'gl-sturm-keller').id, ['lf3'], jetzt) };
    const tick2 = berechneSpielTick(zustand, T0 + 3 * 60 * 60_000);
    expect(tick2.abgeschlossen).toHaveLength(2);
    expect(tick2.incidents).toHaveLength(0);
    expect(tick2.grosslagenNeu).toBeUndefined();
    const vorlage = findeGrosslagenVorlage('unwetter-sturm')!;
    expect(tick2.grosslagenBeendet).toEqual([
      expect.objectContaining({ name: vorlage.name, vollstaendig: true, bonus: vorlage.bonus, xp: vorlage.xp }),
    ]);
  });

  it('ein abgegebener Abschnitt: Lage endet ohne Bonus', () => {
    let zustand = { incidents: erzeugeGrosslage(locations, sturmFahrzeuge(), T0, zufall, 'unwetter-sturm')!, vehicles: sturmFahrzeuge(), locations };
    const pkw = abschnitt(zustand.incidents, 'gl-sturm-pkw');
    zustand = { ...zustand, incidents: zustand.incidents.map((e) => (e.id === pkw.id ? { ...e, abgegebenAt: T0 } : e)) };
    zustand = { ...zustand, ...alarmiereFahrzeuge(zustand, abschnitt(zustand.incidents, 'gl-sturm-baum').id, ['hlf'], T0) };

    const tick1 = berechneSpielTick(zustand, T0 + 60 * 60_000);
    expect(tick1.verfallen.map((e) => e.id)).toEqual([pkw.id]);
    expect(tick1.incidents.every((e) => e.grosslage?.unvollstaendig)).toBe(true);

    zustand = { ...zustand, incidents: tick1.incidents, vehicles: tick1.vehicles };
    const jetzt = T0 + 61 * 60_000;
    zustand = { ...zustand, ...alarmiereFahrzeuge(zustand, abschnitt(zustand.incidents, 'gl-sturm-dach').id, ['dlk', 'lf2'], jetzt) };
    zustand = { ...zustand, ...alarmiereFahrzeuge(zustand, abschnitt(zustand.incidents, 'gl-sturm-keller').id, ['lf3'], jetzt) };
    const tick2 = berechneSpielTick(zustand, T0 + 3 * 60 * 60_000);
    expect(tick2.grosslagenBeendet).toEqual([expect.objectContaining({ vollstaendig: false, bonus: 0, xp: 0 })]);
  });

  it('nie alarmiert: alle Abschnitte verfallen, die Lage endet ohne Welle 2', () => {
    const zustand = { incidents: erzeugeGrosslage(locations, sturmFahrzeuge(), T0, zufall, 'unwetter-sturm')!, vehicles: sturmFahrzeuge(), locations };
    const tick = berechneSpielTick(zustand, T0 + 24 * 60 * 60_000);
    expect(tick.incidents).toHaveLength(0);
    expect(tick.grosslagenNeu).toBeUndefined();
    expect(tick.grosslagenBeendet).toEqual([expect.objectContaining({ vollstaendig: false })]);
  });
});

describe('Großschadenslagen – Laufbahn', () => {
  it('Erfolge für bewältigte Lagen', () => {
    const erfolg = ERFOLGE.find((e) => e.id === 'grosslage-1')!;
    const stand = { einsaetze: 0, perfekt: 0, wachen: 0, feuerwachen: 0, fahrzeuge: 0, fahrzeugTypen: [], ruf: 0, eigenesKrankenhaus: false, guthaben: 0 };
    expect(erfolg.erreicht(stand)).toBe(false);
    expect(erfolg.erreicht({ ...stand, grosslagen: 1 })).toBe(true);
  });

  it('Schummelschutz: Zahl der Lagen wächst nicht schneller als die Einsätze', () => {
    const alt = { ...LAUFBAHN_START, grosslagen: 0 };
    expect(pruefeLaufbahn(alt, { ...alt, einsaetze: 8, grosslagen: 2 }, 60_000).gekappt).toBe(false);
    const geprueft = pruefeLaufbahn(alt, { ...alt, grosslagen: 10_000 }, 60_000);
    expect(geprueft.gekappt).toBe(true);
    expect(geprueft.laufbahn.grosslagen).toBeLessThan(100);
    // Ältere Spielstände ohne Zähler bleiben unverändert
    expect(pruefeLaufbahn(LAUFBAHN_START, LAUFBAHN_START, 60_000).gekappt).toBe(false);
  });
});
