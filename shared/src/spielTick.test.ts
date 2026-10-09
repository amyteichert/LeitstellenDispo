import { describe, expect, it } from 'vitest';
import { alarmiereFahrzeuge } from './alarmierung.js';
import { berechneSpielTick } from './spielTick.js';
import { findeEinsatzVorlage } from './daten.js';
import { T0, einsatz, fahrzeug, wache } from './testHilfen.js';

const locations = [wache()];

describe('berechneSpielTick – Einsatzablauf', () => {
  it('führt einen Einsatz von der Alarmierung bis zur Rückkehr an die Wache', () => {
    const e = einsatz('sturz');
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations }, e.id, ['rtw'], T0);
    expect(start.incidents[0].status).toBe('alarmiert');
    const ankunft = start.incidents[0].alarmedVehicles[0].arrivalAt;
    expect(ankunft).toBeGreaterThan(T0);

    // Unterwegs: noch nichts passiert
    const unterwegs = berechneSpielTick({ ...start, locations }, T0 + 1000);
    expect(unterwegs.incidents[0].status).toBe('alarmiert');

    // Ankunft: Bearbeitung beginnt genau zur Ankunftszeit
    const angekommen = berechneSpielTick({ ...unterwegs, locations }, ankunft);
    expect(angekommen.incidents[0].status).toBe('in_bearbeitung');
    expect(angekommen.incidents[0].processingStartedAt).toBe(ankunft);
    expect(angekommen.vehicles[0].status).toBe('Im Einsatz');

    // Ende der Bearbeitung: abgeschlossen, Belohnung, Rückfahrt
    const ende = angekommen.incidents[0].processingEndsAt!;
    const fertig = berechneSpielTick({ ...angekommen, locations }, ende);
    expect(fertig.incidents).toHaveLength(0);
    expect(fertig.abgeschlossen).toHaveLength(1);
    expect(fertig.abgeschlossen[0].reward).toBe(findeEinsatzVorlage('sturz')!.reward);
    expect(fertig.abgeschlossen[0].completedAt).toBe(ende);
    expect(fertig.vehicles[0].status).toBe('Rückfahrt');
    expect(fertig.vehicles[0].rueckfahrt?.startAt).toBe(ende);

    // An der Wache wieder einsatzbereit
    const zurueck = berechneSpielTick({ ...fertig, locations }, fertig.vehicles[0].rueckfahrt!.ankunftAt);
    expect(zurueck.vehicles[0].status).toBe('Einsatzbereit');
    expect(zurueck.vehicles[0].rueckfahrt).toBeUndefined();
  });

  it('holt verpasste Zeit nach, wenn das Spiel lange geschlossen war', () => {
    const e = einsatz('sturz');
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW')], locations }, e.id, ['rtw'], T0);
    const ankunft = start.incidents[0].alarmedVehicles[0].arrivalAt;

    // Eine Stunde später: ein einziger Tick schließt den Einsatz mit den echten Zeitpunkten ab
    const spaeter = berechneSpielTick({ ...start, locations }, T0 + 60 * 60 * 1000);
    expect(spaeter.abgeschlossen).toHaveLength(1);
    expect(spaeter.abgeschlossen[0].processingStartedAt).toBe(ankunft);
    expect(spaeter.abgeschlossen[0].completedAt).toBe(ankunft + spaeter.abgeschlossen[0].durationSeconds * 1000);

    // Die Rückfahrt ist ebenfalls längst vorbei
    const danach = berechneSpielTick({ ...spaeter, locations }, T0 + 60 * 60 * 1000);
    expect(danach.vehicles[0].status).toBe('Einsatzbereit');
  });

  it('beginnt die Bearbeitung erst, wenn alle benötigten Fahrzeuge da sind', () => {
    const e = einsatz('reanimation');
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles: [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')], locations }, e.id, ['rtw'], T0);
    const spaeter = berechneSpielTick({ ...start, locations }, T0 + 60 * 60 * 1000);
    expect(spaeter.incidents[0].status).toBe('alarmiert');
    expect(spaeter.abgeschlossen).toHaveLength(0);
  });

  it('meldet keine Änderung, wenn nichts passiert', () => {
    const vehicles = [fahrzeug('rtw', 'RTW')];
    const incidents = [einsatz('sturz')];
    const ergebnis = berechneSpielTick({ vehicles, incidents, locations }, T0);
    expect(ergebnis.geaendert).toBe(false);
    expect(ergebnis.vehicles).toBe(vehicles);
    expect(ergebnis.incidents).toBe(incidents);
  });
});

describe('berechneSpielTick – Eskalation', () => {
  const alarmiertesRd1 = (vehicles = [fahrzeug('rtw', 'RTW'), fahrzeug('nef', 'NEF')]) => {
    const e = einsatz('kreislaufprobleme', 0.5);
    return alarmiereFahrzeuge({ incidents: [e], vehicles, locations }, e.id, ['rtw'], T0);
  };

  it('eskaliert während der Bearbeitung in den größeren Einsatz', () => {
    const start = alarmiertesRd1();
    const ankunft = start.incidents[0].alarmedVehicles[0].arrivalAt;
    const inBearbeitung = berechneSpielTick({ ...start, locations }, ankunft);
    const dauer = inBearbeitung.incidents[0].durationSeconds * 1000;
    const eskalationsZeit = ankunft + 0.5 * dauer;

    const eskaliert = berechneSpielTick({ ...inBearbeitung, locations }, eskalationsZeit);
    const e = eskaliert.incidents[0];
    expect(e.stichwort).toBe('RD 2');
    expect(e.vorlageId).toBe('reanimation');
    expect(e.status).toBe('alarmiert');
    expect(e.reward).toBe(findeEinsatzVorlage('reanimation')!.reward);
    expect(e.neueMeldung).toBe(true);
    // Erst die Lagemeldung beim Eintreffen, dann die Eskalation samt begründeter Nachforderung
    expect(e.meldungen.map((m) => m.art)).toEqual(['lage', 'eskalation', 'nachforderung']);
    expect(e.meldungen[1].zeit).toBe(eskalationsZeit);
    expect(e.meldungen[2].text).toContain('1× NEF');
    expect(e.processingStartedAt).toBeUndefined();
    // Der RTW bleibt am Einsatz, es fehlt nur der NEF
    expect(e.alarmedVehicles.map((a) => a.vehicleId)).toEqual(['rtw']);
  });

  it('eskaliert nicht, wenn der Spieler den größeren Einsatz nicht schaffen kann', () => {
    const start = alarmiertesRd1([fahrzeug('rtw', 'RTW')]); // kein NEF vorhanden
    const spaeter = berechneSpielTick({ ...start, locations }, T0 + 60 * 60 * 1000);
    expect(spaeter.abgeschlossen).toHaveLength(1);
    expect(spaeter.abgeschlossen[0].stichwort).toBe('RD 1');
  });
});

describe('berechneSpielTick – Einsätze ohne Alarmierung', () => {
  const feuerwache = [wache('rw-1', 'Feuerwache')];

  it('eskaliert einen liegen gelassenen Einsatz und lässt ihn bestehen', () => {
    const eskalationsZeit = T0 + 3 * 60 * 1000;
    const e = einsatz('kleinbrand', undefined, eskalationsZeit);
    const vehicles = [fahrzeug('lf1', 'LF 10'), fahrzeug('lf2', 'LF 20')];

    const vorher = berechneSpielTick({ vehicles, incidents: [e], locations: feuerwache }, eskalationsZeit - 1);
    expect(vorher.geaendert).toBe(false);

    const ergebnis = berechneSpielTick({ vehicles, incidents: [e], locations: feuerwache }, eskalationsZeit);
    const eskaliert = ergebnis.incidents[0];
    expect(eskaliert.stichwort).toBe('B 2');
    expect(eskaliert.meldebild).toBe('Kellerbrand');
    expect(eskaliert.status).toBe('offen');
    expect(eskaliert.neueMeldung).toBe(true);
    expect(eskaliert.meldungen[0].zeit).toBe(eskalationsZeit);
  });

  it('eskaliert nicht, wenn der größere Einsatz nicht schaffbar wäre', () => {
    const eskalationsZeit = T0 + 3 * 60 * 1000;
    const e = einsatz('kleinbrand', undefined, eskalationsZeit);
    const ergebnis = berechneSpielTick({ vehicles: [fahrzeug('lf1', 'LF 10')], incidents: [e], locations: feuerwache }, eskalationsZeit);
    expect(ergebnis.incidents[0].stichwort).toBe('B 1');
    expect(ergebnis.incidents[0].eskalationOhneAlarmAt).toBeUndefined();
  });

  it('lässt nie alarmierte Einsätze frühestens nach 12 Stunden verschwinden', () => {
    const e = einsatz('sturz');
    const vehicles = [fahrzeug('rtw', 'RTW')];
    const zwoelfStunden = 12 * 60 * 60 * 1000;

    const knappDavor = berechneSpielTick({ vehicles, incidents: [e], locations }, T0 + zwoelfStunden - 1);
    expect(knappDavor.incidents).toHaveLength(1);

    const danach = berechneSpielTick({ vehicles, incidents: [e], locations }, T0 + zwoelfStunden);
    expect(danach.incidents).toHaveLength(0);
    expect(danach.verfallen).toEqual([e]);
    expect(danach.abgeschlossen).toHaveLength(0);
  });
});

describe('berechneSpielTick – Randfälle der Eskalation', () => {
  const feuerwache = [wache('rw-1', 'Feuerwache')];
  /** Tickt so lange zum selben Zeitpunkt, bis sich nichts mehr ändert (wie beim Öffnen nach langer Pause). */
  const tickeBisRuhe = (zustand: Parameters<typeof berechneSpielTick>[0], jetzt: number) => {
    let aktuell = { ...zustand };
    const abgeschlossen = [];
    for (let i = 0; i < 10; i += 1) {
      const ergebnis = berechneSpielTick(aktuell, jetzt);
      abgeschlossen.push(...ergebnis.abgeschlossen);
      if (!ergebnis.geaendert) break;
      aktuell = { ...aktuell, vehicles: ergebnis.vehicles, incidents: ergebnis.incidents };
    }
    return { ...aktuell, abgeschlossen };
  };

  it('setzt die Bearbeitung fort, wenn die Fahrzeuge vor Ort für den größeren Einsatz reichen', () => {
    const e = einsatz('kleinbrand', 0.5);
    const vehicles = [fahrzeug('lf1', 'LF 10'), fahrzeug('lf2', 'LF 20')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles, locations: feuerwache }, e.id, ['lf1', 'lf2'], T0);
    const ankunft = Math.max(...start.incidents[0].alarmedVehicles.map((a) => a.arrivalAt));

    const inBearbeitung = berechneSpielTick({ ...start, locations: feuerwache }, ankunft);
    // Bearbeitung beginnt mit dem ersten LF – mehr braucht der Kleinbrand nicht
    const beginn = inBearbeitung.incidents[0].processingStartedAt!;
    expect(beginn).toBe(Math.min(...start.incidents[0].alarmedVehicles.map((a) => a.arrivalAt)));
    const eskalationsZeit = beginn + 0.5 * inBearbeitung.incidents[0].durationSeconds * 1000;
    const eskaliert = berechneSpielTick({ ...inBearbeitung, locations: feuerwache }, eskalationsZeit);
    expect(eskaliert.incidents[0].meldebild).toBe('Kellerbrand');

    // Beide LF sind schon vor Ort → Bearbeitung des Kellerbrands beginnt ab der Lagemeldung
    const weiter = berechneSpielTick({ ...eskaliert, locations: feuerwache }, eskalationsZeit);
    expect(weiter.incidents[0].status).toBe('in_bearbeitung');
    expect(weiter.incidents[0].processingStartedAt).toBe(eskalationsZeit);
  });

  it('schließt einen eskalierten Einsatz offline korrekt ab (mit Belohnung des größeren Einsatzes)', () => {
    const e = einsatz('kleinbrand', 0.5);
    const vehicles = [fahrzeug('lf1', 'LF 10'), fahrzeug('lf2', 'LF 20')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles, locations: feuerwache }, e.id, ['lf1', 'lf2'], T0);

    const ergebnis = tickeBisRuhe({ ...start, locations: feuerwache }, T0 + 60 * 60 * 1000);
    expect(ergebnis.incidents).toHaveLength(0);
    expect(ergebnis.abgeschlossen).toHaveLength(1);
    const fertig = ergebnis.abgeschlossen[0];
    expect(fertig.meldebild).toBe('Kellerbrand');
    expect(fertig.reward).toBe(findeEinsatzVorlage('kellerbrand')!.reward);
    // Ende = Lagemeldung + Dauer des Kellerbrands (nicht "jetzt")
    const eskalation = fertig.meldungen.find((m) => m.art === 'eskalation')!;
    expect(fertig.completedAt).toBe(eskalation.zeit + fertig.durationSeconds * 1000);
    expect(ergebnis.vehicles.every((v) => v.status === 'Einsatzbereit')).toBe(true);
  });

  it('wartet nach einer Eskalation auf Nachalarmierung und schließt nicht vorzeitig ab', () => {
    const e = einsatz('kleinbrand', 0.5);
    const vehicles = [fahrzeug('lf1', 'LF 10'), fahrzeug('lf2', 'LF 20')];
    const start = alarmiereFahrzeuge({ incidents: [e], vehicles, locations: feuerwache }, e.id, ['lf1'], T0);

    const ergebnis = tickeBisRuhe({ ...start, locations: feuerwache }, T0 + 60 * 60 * 1000);
    expect(ergebnis.abgeschlossen).toHaveLength(0);
    expect(ergebnis.incidents[0].meldebild).toBe('Kellerbrand');
    expect(ergebnis.incidents[0].status).toBe('alarmiert');
    // Das LF bleibt am Einsatzort und ist nicht verfügbar
    expect(ergebnis.vehicles.find((v) => v.id === 'lf1')?.status).toBe('Im Einsatz');
  });

  it('kann über mehrere Stufen eskalieren (Kleinbrand → Kellerbrand → Zimmerbrand)', () => {
    const e = einsatz('kleinbrand', undefined, T0 + 1000);
    const vehicles = [fahrzeug('lf1', 'LF 10'), fahrzeug('lf2', 'LF 20'), fahrzeug('dlk', 'DLK 23/12')];
    const erste = berechneSpielTick({ vehicles, incidents: [e], locations: feuerwache }, T0 + 1000);
    expect(erste.incidents[0].meldebild).toBe('Kellerbrand');

    // Zweite Stufe gezielt auslösen (die Wahrscheinlichkeit wird im Spiel ausgewürfelt)
    const zweiteZeit = T0 + 5000;
    const zweite = berechneSpielTick(
      { vehicles, incidents: [{ ...erste.incidents[0], eskalationOhneAlarmAt: zweiteZeit }], locations: feuerwache },
      zweiteZeit,
    );
    expect(zweite.incidents[0].meldebild).toBe('Zimmerbrand');
    expect(zweite.incidents[0].meldungen).toHaveLength(2);
    expect(zweite.incidents[0].createdAt).toBe(T0); // 12-Stunden-Frist läuft ab der ersten Meldung
  });
});
