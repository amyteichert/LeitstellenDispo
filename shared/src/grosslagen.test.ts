import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge } from './alarmierung.js';
import {
  darfGrosslageEntstehen,
  erzeugeGrosslage,
  findeGrosslagenVorlage,
  getGrosslagenStaende,
  getMachbareGrosslagen,
  GROSSLAGEN_VORLAGEN,
  istGrosslageFreigeschaltet,
  waehleGrosslage,
  grosslagenIntervallMs,
  getUnwetterLagen,
  GROSSLAGEN_CONFIG,
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
    expect(getMachbareGrosslagen(sturmFahrzeuge()).map((lage) => lage.id)).toEqual(['unwetter-starkregen', 'unwetter-sturm']);
    // Fahrzeuge ohne Wache zählen nicht
    expect(getMachbareGrosslagen(sturmFahrzeuge().map((v) => ({ ...v, stationId: undefined })))).toHaveLength(0);
  });

  it('entsteht erst ab Rang 2 (kleinste Lage) und wenn keine andere Lage läuft', () => {
    const xp = (stufe: number) => RAENGE.find((rang) => rang.stufe === stufe)!.abXp;
    expect(darfGrosslageEntstehen(xp(2) - 1, 5, [])).toBe(false);
    expect(darfGrosslageEntstehen(xp(2), 1, [])).toBe(true);
    const lage = erzeugeGrosslage(locations, sturmFahrzeuge(), T0, { zufall })!;
    expect(darfGrosslageEntstehen(xp(7), 20, lage)).toBe(false);
  });

  it('mit nur einem LF: die Starkregen-Lage ab Rang 2 – sonst nichts', () => {
    const nurLF = [fw('lf', 'LF 20')];
    const xp = (stufe: number) => RAENGE.find((rang) => rang.stufe === stufe)!.abXp;
    expect(getMachbareGrosslagen(nurLF).map((lage) => lage.id)).toEqual(['unwetter-starkregen']);
    expect(getMachbareGrosslagen(nurLF, { xp: 0, wachen: 1 })).toHaveLength(0);
    expect(getMachbareGrosslagen(nurLF, { xp: xp(2), wachen: 1 }).map((lage) => lage.id)).toEqual(['unwetter-starkregen']);
    const lage = erzeugeGrosslage([wache('fw-1', 'Feuerwache')], nurLF, T0, { zufall, xp: xp(2) })!;
    expect(lage.map((e) => e.vorlageId).sort()).toEqual(['gl-starkregen-keller', 'gl-starkregen-strasse']);
    // Ohne Rang kommt sie nicht von selbst, über das Dev-Werkzeug (ohne xp) schon
    expect(erzeugeGrosslage([wache('fw-1', 'Feuerwache')], nurLF, T0, { zufall, xp: 0 })).toBeNull();
    expect(erzeugeGrosslage([wache('fw-1', 'Feuerwache')], nurLF, T0, { zufall })).not.toBeNull();
  });

  it('Stufen steigen mit Rang und Wachen, die härteste Lage braucht eine große Leitstelle', () => {
    const sortiert = [...GROSSLAGEN_VORLAGEN].sort((a, b) => a.stufe - b.stufe);
    for (let i = 1; i < sortiert.length; i++) {
      expect(sortiert[i].abRang).toBeGreaterThanOrEqual(sortiert[i - 1].abRang);
      expect(sortiert[i].abWachen).toBeGreaterThanOrEqual(sortiert[i - 1].abWachen);
      expect(sortiert[i].bonus).toBeGreaterThanOrEqual(sortiert[i - 1].bonus);
    }
    const chemie = findeGrosslagenVorlage('grossbrand-chemiepark')!;
    expect(chemie.stufe).toBe(5);
    expect(istGrosslageFreigeschaltet(chemie, RAENGE[6].abXp, 5)).toBe(false);
    expect(istGrosslageFreigeschaltet(chemie, RAENGE[6].abXp, 6)).toBe(true);
  });

  it('große Leitstelle: meistens die härteste machbare Lage, kleinere nur ab und zu', () => {
    const lagen = GROSSLAGEN_VORLAGEN;
    const zaehler = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      const lage = waehleGrosslage(lagen, () => (i + 0.5) / 1000);
      zaehler.set(lage.id, (zaehler.get(lage.id) ?? 0) + 1);
    }
    expect(zaehler.get('grossbrand-chemiepark')!).toBeGreaterThan(500);
    expect(zaehler.get('unwetter-starkregen') ?? 0).toBeGreaterThan(0);
    expect(zaehler.get('unwetter-starkregen') ?? 0).toBeLessThan(20);
  });

  it('die brutale Chemiepark-Lage ist mit einem großen Fuhrpark machbar', () => {
    const gross: Vehicle[] = [
      ...['1', '2', '3', '4'].map((n) => fw(`lf${n}`, 'LF 20')), fw('dlk1', 'DLK 23/12'), fw('dlk2', 'DLK 23/12'), fw('elw2', 'ELW 2'),
      fw('gwa', 'GW-A'), fw('gwg', 'GW-G'), fw('gwm', 'GW-Mess'), fw('sw1', 'SW 2000'), fw('sw2', 'SW 2000'), fw('gwl', 'GW-L2'),
      ...['1', '2', '3', '4'].map((n) => rd(`rtw${n}`, 'RTW')), rd('nef1', 'NEF'), rd('nef2', 'NEF'), rd('lna', 'KdoW-LNA'),
      rd('orgl', 'KdoW-OrgL'), rd('gwsan', 'GW-San'),
    ];
    expect(getMachbareGrosslagen(gross).map((lage) => lage.id)).toContain('grossbrand-chemiepark');
    // Ein LF weniger: der Brandabschnitt braucht 4 – dann nicht mehr
    expect(getMachbareGrosslagen(gross.filter((v) => v.id !== 'lf4')).map((lage) => lage.id)).not.toContain('grossbrand-chemiepark');
  });
});

describe('Großschadenslagen – Wetter', () => {
  const xp = (stufe: number) => RAENGE.find((rang) => rang.stufe === stufe)!.abXp;
  const fwWache = [wache('fw-1', 'Feuerwache')];
  const nurLF = [fw('lf', 'LF 20')];

  it('Starkregen nur bei Regen oder Gewitter/Sturm, Orkanböen nur bei Sturm', () => {
    const freigabe = (wetter: 'klar' | 'regen' | 'sturm' | 'hitze' | 'glaette') => ({ xp: xp(7), wachen: 10, wetter });
    const ids = (wetter: Parameters<typeof freigabe>[0]) => getMachbareGrosslagen(sturmFahrzeuge(), freigabe(wetter)).map((l) => l.id);
    expect(ids('klar')).toEqual([]);
    expect(ids('hitze')).toEqual([]);
    expect(ids('glaette')).toEqual([]);
    expect(ids('regen')).toEqual(['unwetter-starkregen']);
    expect(ids('sturm')).toEqual(['unwetter-starkregen', 'unwetter-sturm']);
    expect(getUnwetterLagen('sturm').map((l) => l.id)).toEqual(['unwetter-starkregen', 'unwetter-sturm']);
    expect(getUnwetterLagen('klar')).toEqual([]);
  });

  it('mit nur einem LF: bei Sonne keine Lage, bei Regen die Starkregen-Lage', () => {
    expect(erzeugeGrosslage(fwWache, nurLF, T0, { zufall, xp: xp(2), wetter: 'klar' })).toBeNull();
    const lage = erzeugeGrosslage(fwWache, nurLF, T0, { zufall, xp: xp(2), wetter: 'regen' })!;
    expect(lage[0].grosslage!.vorlageId).toBe('unwetter-starkregen');
    // Dev-Werkzeug (ohne xp) prüft das Wetter nicht
    expect(erzeugeGrosslage(fwWache, nurLF, T0, { zufall })).not.toBeNull();
  });

  it('passendes Wetter: Großlagen kommen häufiger – aber nur, wenn die Unwetterlage machbar ist', () => {
    const normal = GROSSLAGEN_CONFIG.intervallMs;
    expect(grosslagenIntervallMs(nurLF, { xp: xp(2), wachen: 1, wetter: 'klar' })).toBe(normal);
    expect(grosslagenIntervallMs(nurLF, { xp: xp(2), wachen: 1, wetter: 'regen' })).toBe(normal / GROSSLAGEN_CONFIG.wetterHaeufiger);
    // Rang reicht nicht → kein Unterschied
    expect(grosslagenIntervallMs(nurLF, { xp: 0, wachen: 1, wetter: 'regen' })).toBe(normal);
  });

  it('bei Sturm wird die Unwetterlage bevorzugt, auch wenn härtere Lagen machbar wären', () => {
    const lagen = GROSSLAGEN_VORLAGEN;
    let unwetter = 0;
    for (let i = 0; i < 1000; i++) if (waehleGrosslage(lagen, () => (i + 0.5) / 1000, 'sturm').wetter) unwetter++;
    expect(unwetter).toBeGreaterThan(600);
  });
});

describe('Großschadenslagen – Ablauf', () => {
  it('erste Welle entsteht sofort, zuständig ist die passende Wache', () => {
    const lage = erzeugeGrosslage(locations, sturmFahrzeuge(), T0, { zufall, vorlageId: 'unwetter-sturm' })!;
    expect(lage.map((e) => e.vorlageId).sort()).toEqual(['gl-sturm-baum', 'gl-sturm-pkw']);
    expect(new Set(lage.map((e) => e.grosslage!.id)).size).toBe(1);
    expect(lage.every((e) => e.generatedByStationId === 'fw-1')).toBe(true);
    // Abschnitte liegen nicht aufeinander
    expect(lage[0].coords).not.toEqual(lage[1].coords);
    const [stand] = getGrosslagenStaende(lage);
    expect(stand).toMatchObject({ name: 'Unwetterlage – Orkanböen', offen: 2, gesamt: 4, erkundungAusstehend: true });
    // Kreis auf der Karte umfasst alle Abschnitte – auch wenn einer weiter weg auf die Straße gerückt ist
    expect(stand.radiusKm).toBeCloseTo(0.6, 5);
    const verschoben = lage.map((e, i) => (i === 1 ? { ...e, coords: [e.grosslage!.zentrum[0] + 0.009, e.grosslage!.zentrum[1]] as [number, number] } : e));
    expect(getGrosslagenStaende(verschoben)[0].radiusKm).toBeGreaterThan(1.1);
  });

  it('Erkundung löst Welle 2 aus, nach dem letzten Abschnitt gibt es den Abschlussbonus', () => {
    let zustand = { incidents: erzeugeGrosslage(locations, sturmFahrzeuge(), T0, { zufall, vorlageId: 'unwetter-sturm' })!, vehicles: sturmFahrzeuge(), locations };
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
    let zustand = { incidents: erzeugeGrosslage(locations, sturmFahrzeuge(), T0, { zufall, vorlageId: 'unwetter-sturm' })!, vehicles: sturmFahrzeuge(), locations };
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
    const zustand = { incidents: erzeugeGrosslage(locations, sturmFahrzeuge(), T0, { zufall, vorlageId: 'unwetter-sturm' })!, vehicles: sturmFahrzeuge(), locations };
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
