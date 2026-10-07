import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge, getVerfuegbareFahrzeugeFuerEinsatz } from './alarmierung.js';
import { getBewertungsHinweise, getFristPunkte, getRufLabel, getWahlPunkte, rechneEinsaetzeAb, RUF_CONFIG } from './bewertung.js';
import type { AbgeschlossenerSpielEinsatz } from './daten.js';
import { migriereSpielstand, createNeuesSpiel } from './spielstand.js';
import { berechneSpielTick } from './spielTick.js';
import { T0, einsatz, fahrzeug, wache } from './testHilfen.js';

const abgeschlossen = (anfahrtSekunden: number, reward = 300, alarmiertAt = T0 + 10 * 60 * 1000): AbgeschlossenerSpielEinsatz => ({
  ...einsatz('sturz'),
  reward,
  status: 'abgeschlossen',
  alarmedVehicles: [{ vehicleId: 'rtw', distanceKm: 1, etaSeconds: anfahrtSekunden, arrivalAt: alarmiertAt + anfahrtSekunden * 1000 }],
  erstesEintreffenAt: alarmiertAt + anfahrtSekunden * 1000,
  completedAt: alarmiertAt + 600_000,
  totalDurationSeconds: 60,
});

describe('Punkte', () => {
  it('Hilfsfrist: volle Punkte bei schneller Anfahrt, keine bei sehr langer, dazwischen linear', () => {
    expect(getFristPunkte(60)).toBe(50);
    expect(getFristPunkte(RUF_CONFIG.anfahrtVollSekunden)).toBe(50);
    expect(getFristPunkte(270)).toBe(25);
    expect(getFristPunkte(RUF_CONFIG.anfahrtNullSekunden)).toBe(0);
  });

  it('Fahrzeugwahl: Abzug, wenn ein deutlich langsameres als das beste freie Fahrzeug geschickt wurde', () => {
    expect(getWahlPunkte(100, 90)).toBe(50);
    expect(getWahlPunkte(300, 60)).toBe(0);
    expect(getWahlPunkte(142, 60)).toBe(25);
    expect(getWahlPunkte(300)).toBe(50);
  });

  it('weit entfernter Einsatz mit dem nächsten Fahrzeug: volle Wahlpunkte, aber Abzug bei der Hilfsfrist', () => {
    const e = { ...abgeschlossen(300), besteAnfahrtSekunden: 300 };
    expect(rechneEinsaetzeAb([e], 50).einsaetze[0].bewertung).toMatchObject({ wahlPunkte: 50, fristPunkte: 20, punkte: 70 });
  });

  it('nahes Fahrzeug übersehen: Abzug bei der Fahrzeugwahl', () => {
    const e = { ...abgeschlossen(200), besteAnfahrtSekunden: 40 };
    expect(rechneEinsaetzeAb([e], 50).einsaetze[0].bewertung).toMatchObject({ wahlPunkte: 0, fristPunkte: 37 });
  });
});

describe('Fehlerübersicht', () => {
  const hinweise = (e: AbgeschlossenerSpielEinsatz) => getBewertungsHinweise(rechneEinsaetzeAb([e], 50).einsaetze[0].bewertung!);

  it('nennt ein übersehenes nahes Fahrzeug und die überschrittene Hilfsfrist', () => {
    const texte = hinweise({ ...abgeschlossen(200), besteAnfahrtSekunden: 40 });
    expect(texte.filter((h) => h.art === 'fehler').map((h) => h.text)).toEqual([
      'Nicht das nächste freie Fahrzeug geschickt: 2:40 Min. langsamer als möglich (3:20 Min. statt 0:40 Min.).',
      'Hilfsfrist überschritten: Anfahrt 3:20 Min. (volle Punkte bis 2:00 Min.).',
    ]);
  });

  it('schlägt eine neue Wache vor, wenn schon das beste Fahrzeug zu weit weg war', () => {
    const texte = hinweise({ ...abgeschlossen(300), besteAnfahrtSekunden: 300 });
    expect(texte[0]).toEqual({ art: 'gut', text: 'Nächstes freies Fahrzeug gewählt.' });
    expect(texte[1].text).toContain('neue Wache');
  });

  it('keine Fehler bei perfekter Arbeit', () => {
    expect(hinweise({ ...abgeschlossen(60), besteAnfahrtSekunden: 60 }).every((h) => h.art === 'gut')).toBe(true);
  });
});

describe('Freie Fahrzeugwahl', () => {
  it('zeigt auch Fahrzeuge, die nicht zum Bedarf passen (z. B. LF beim Rettungsdienst), und erlaubt deren Alarmierung', () => {
    const locations = [wache('rw-1'), wache('fw-1', 'Feuerwache')];
    const e = einsatz('sturz');
    const vehicles = [fahrzeug('lf', 'LF 10', 'fw-1'), fahrzeug('rtw', 'RTW', 'rw-1')];
    const liste = getVerfuegbareFahrzeugeFuerEinsatz(e, { incidents: [e], vehicles, locations });
    expect(liste.map((f) => [f.vehicle.id, f.passend])).toEqual([['rtw', true], ['lf', false]]);

    const alarmiert = alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['lf'], T0);
    expect(alarmiert.incidents[0].alarmedVehicles.map((a) => a.vehicleId)).toEqual(['lf']);
  });
});

describe('Erstalarmierung merkt sich das beste freie Fahrzeug', () => {
  it('auch wenn ein langsameres alarmiert wird', () => {
    const nah = wache('rw-1');
    const fern = { ...wache('rw-2'), coords: [48.73, 9.1771] as [number, number] };
    const e = einsatz('sturz');
    const vehicles = [fahrzeug('nah', 'RTW', 'rw-1'), fahrzeug('fern', 'RTW', 'rw-2')];
    const ergebnis = alarmiereFahrzeuge({ incidents: [e], vehicles, locations: [nah, fern] }, e.id, ['fern'], T0);
    const alarmiert = ergebnis.incidents[0];
    expect(alarmiert.besteAnfahrtSekunden).toBeLessThan(alarmiert.alarmedVehicles[0].etaSeconds);
  });
});

describe('Abrechnung mit Ruf', () => {
  it('zahlt immer das Grundgeld und einen Bonus abhängig von Leistung und Ruf', () => {
    const { einsaetze } = rechneEinsaetzeAb([abgeschlossen(60)], 50);
    // 300 € × 0,8 × 100 % Punkte × Ruf 50 % = 120 €
    expect(einsaetze[0].bewertung).toMatchObject({ grundgeld: 300, bonus: 120, punkte: 100, rufAenderung: 2 });
  });

  it('bei Ruf 0 gibt es nur das Grundgeld', () => {
    const { einsaetze } = rechneEinsaetzeAb([abgeschlossen(60)], 0);
    expect(einsaetze[0].bewertung?.bonus).toBe(0);
    expect(einsaetze[0].reward).toBe(300);
  });

  it('wertet nur die Zeit ab Alarmierung – langes Liegenlassen kostet nichts', () => {
    const spaetAlarmiert = abgeschlossen(60, 300, T0 + 5 * 60 * 60 * 1000);
    expect(rechneEinsaetzeAb([spaetAlarmiert], 50).einsaetze[0].bewertung?.punkte).toBe(100);
  });

  it('lange Anfahrt mit falschem Fahrzeug senkt den Ruf, der Ruf bleibt zwischen 0 und 100', () => {
    const schlecht = { ...abgeschlossen(500), besteAnfahrtSekunden: 60 };
    expect(rechneEinsaetzeAb([schlecht], 50).ruf).toBe(48);
    expect(rechneEinsaetzeAb([schlecht], 1).ruf).toBe(0);
    expect(rechneEinsaetzeAb([abgeschlossen(60)], 99).ruf).toBe(100);
  });

  it('mehrere Einsätze werden nacheinander mit dem jeweils aktuellen Ruf abgerechnet', () => {
    const ergebnis = rechneEinsaetzeAb([abgeschlossen(60), abgeschlossen(60)], 50);
    expect(ergebnis.einsaetze.map((e) => e.bewertung?.rufVorher)).toEqual([50, 52]);
    expect(ergebnis.ruf).toBe(54);
  });

  it('hat sprechende Rufstufen', () => {
    expect(getRufLabel(50)).toBe('Durchschnittlich');
    expect(getRufLabel(90)).toBe('Hervorragend');
    expect(getRufLabel(5)).toBe('Schlecht');
  });
});

describe('Spielstand', () => {
  it('neues Spiel startet mit Ruf 50, alte Spielstände ohne Ruf ebenfalls', () => {
    const neu = createNeuesSpiel();
    expect(neu.ruf).toBe(RUF_CONFIG.start);
    const { ruf: _ruf, ...alt } = neu;
    expect(migriereSpielstand(alt)?.ruf).toBe(RUF_CONFIG.start);
    expect(migriereSpielstand({ ...neu, ruf: 77 })?.ruf).toBe(77);
  });
});

describe('Unklare Meldung und Entwarnung', () => {
  const locations = [wache()];

  it('markiert Einsätze, deren Bedarf sich vor Ort ändern kann, als unklar', () => {
    expect(einsatz('bewusstlose-person').meldungUnklar).toBe(true);
    expect(einsatz('schnittverletzung').meldungUnklar).toBe(false);
    expect(einsatz('bewusstlose-person').empfehlung?.map((b) => b.category)).toEqual(['RTW', 'NEF']);
  });

  it('Entwarnung: Bedarf sinkt beim Eintreffen, das überzählige NEF rückt ab', () => {
    const e = einsatz('bewusstlose-person', undefined, undefined, { entwarnung: true });
    const vehicles = [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['rtw', 'nef'], T0);
    const ankunft = Math.min(...start.incidents[0].alarmedVehicles.map((a) => a.arrivalAt));
    const tick = berechneSpielTick({ ...start, locations }, ankunft);
    const lage = tick.incidents[0];

    expect(lage.requiredVehicles.map((b) => b.category)).toEqual(['RTW']);
    expect(lage.meldungen.some((m) => m.art === 'entwarnung')).toBe(true);
    expect(lage.alarmedVehicles.find((a) => a.vehicleId === 'nef')?.freigegebenAt).toBe(ankunft);
    expect(tick.vehicles.find((v) => v.id === 'nef')?.status).toBe('Rückfahrt');
    expect(lage.alarmedVehicles.find((a) => a.vehicleId === 'rtw')?.freigegebenAt).toBeUndefined();
  });

  it('ohne Entwarnung bleibt alles wie gemeldet', () => {
    const e = einsatz('bewusstlose-person');
    const vehicles = [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['rtw', 'nef'], T0);
    const ankunft = Math.min(...start.incidents[0].alarmedVehicles.map((a) => a.arrivalAt));
    const lage = berechneSpielTick({ ...start, locations }, ankunft).incidents[0];
    expect(lage.requiredVehicles.map((b) => b.category)).toEqual(['RTW', 'NEF']);
  });
});
