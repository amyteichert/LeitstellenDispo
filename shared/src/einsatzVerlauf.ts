/** Was mit einem Einsatz im Verlauf passiert: Eskalation, Nachforderung, Entwarnung, Bedarfsabdeckung. */
import { GAME_CONFIG } from './konfig.js';
import {
  ergaenzeBedarf,
  formatBedarfsListe,
  istBedarfGedeckt,
  ordneFahrzeugeBedarfZu,
  type BedarfsKlasse,
  type FahrzeugBedarf,
} from './fahrzeuge.js';
import { erzeugePatienten, schwererZustand, type Patient } from './patienten.js';
import { fuegeMeldungenHinzu, type EinsatzNachforderung, type EinsatzVorlage, type SpielEinsatz } from './daten.js';

/**
 * Würfelt aus, ob (und wann) ein Einsatz eskaliert, wenn sich niemand um ihn kümmert.
 * Nicht jeder Einsatz eskaliert – nur Vorlagen mit Eskalationsstufe und auch dann nur mit deren Wahrscheinlichkeit.
 */
export function planeEskalationOhneAlarm(vorlage: EinsatzVorlage, jetzt: number): number | undefined {
  if (!vorlage.eskalation || Math.random() >= vorlage.eskalation.wahrscheinlichkeit) return undefined;
  const { eskalationOhneAlarmMinMs: min, eskalationOhneAlarmMaxMs: max } = GAME_CONFIG;
  return jetzt + min + Math.random() * (max - min);
}

/** Würfelt aus, ob (und wann während der Bearbeitung) ein Einsatz aus dieser Vorlage eskaliert. */
export function planeEskalation(vorlage: EinsatzVorlage): number | undefined {
  if (!vorlage.eskalation || Math.random() >= vorlage.eskalation.wahrscheinlichkeit) return undefined;
  return 0.3 + Math.random() * 0.4;
}

/** Würfelt aus, ob das erste Fahrzeug vor Ort weitere Kräfte nachfordert. */
export function planeNachforderung(vorlage: EinsatzVorlage, zufall: () => number = Math.random): boolean {
  return Boolean(vorlage.nachforderung) && zufall() < (vorlage.nachforderung?.wahrscheinlichkeit ?? 0);
}

/** Würfelt aus, ob sich die Lage vor Ort als kleiner herausstellt. Nie zusammen mit einer Nachforderung. */
export function planeEntwarnung(vorlage: EinsatzVorlage, nachforderungGeplant: boolean, zufall: () => number = Math.random): boolean {
  return !nachforderungGeplant && Boolean(vorlage.entwarnung) && zufall() < (vorlage.entwarnung?.wahrscheinlichkeit ?? 0);
}

/** Was beim ersten Eintreffen passieren kann: Nachforderung, Entwarnung oder keins von beiden. */
export function planeLageBeimEintreffen(vorlage: EinsatzVorlage, nochNichtEingetroffen = true) {
  const nachforderungGeplant = nochNichtEingetroffen && planeNachforderung(vorlage);
  return {
    nachforderungGeplant,
    entwarnungGeplant: nochNichtEingetroffen && planeEntwarnung(vorlage, nachforderungGeplant),
  };
}

/** Kann sich der Bedarf dieses Einsatzes vor Ort noch ändern? Dann wird er als „Empfehlung“ angezeigt. */
export const istMeldungUnklar = (vorlage: EinsatzVorlage) =>
  Boolean(vorlage.unklar || vorlage.nachforderung || vorlage.entwarnung);

/** Zieht Bedarf ab (z. B. bei einer Entwarnung); Einträge mit 0 fallen weg. */
export function reduziereBedarf(bedarf: FahrzeugBedarf[], abzug: FahrzeugBedarf[]): FahrzeugBedarf[] {
  return bedarf
    .map((eintrag) => {
      const weniger = abzug.filter((a) => a.category === eintrag.category).reduce((summe, a) => summe + a.amount, 0);
      return { ...eintrag, amount: eintrag.amount - weniger };
    })
    .filter((eintrag) => eintrag.amount > 0);
}

/** Patienten nach einer Eskalation: Zustand verschlechtert sich, Transport wird nötig, ggf. kommen Patienten dazu. */
function passePatientenAn(einsatz: SpielEinsatz, ziel: EinsatzVorlage): Patient[] | undefined {
  const bisher = einsatz.patienten ?? [];
  if (!ziel.patienten) return einsatz.patienten;
  const angepasst = bisher.map((patient) => ({
    ...patient,
    zustand: schwererZustand(patient.zustand, ziel.patienten!.zustand),
    transportErforderlich: true,
    status: 'wartet' as const,
  }));
  const fehlend = Math.max(0, ziel.patienten.anzahl - angepasst.length);
  return [
    ...angepasst,
    ...erzeugePatienten({ ...ziel.patienten, anzahl: fehlend, transportWahrscheinlichkeit: 1 }, einsatz.id, Math.random, angepasst.length),
  ];
}

/**
 * Lässt einen Einsatz in die Ziel-Vorlage eskalieren: neues Stichwort, neue Anforderungen und Belohnung.
 * Bereits alarmierte Fahrzeuge bleiben am Einsatz; fehlende müssen nachalarmiert werden.
 */
export function eskaliereEinsatz(einsatz: SpielEinsatz, ziel: EinsatzVorlage, meldung: string, jetzt: number): SpielEinsatz {
  return {
    ...einsatz,
    vorlageId: ziel.id,
    stichwort: ziel.stichwort,
    meldebild: ziel.meldebild,
    requiredVehicles: ziel.requiredVehicles,
    reward: ziel.reward,
    durationSeconds: ziel.durationSeconds,
    status: einsatz.alarmedVehicles.length > 0 ? 'alarmiert' : 'offen',
    processingStartedAt: undefined,
    processingEndsAt: undefined,
    eskalationBei: planeEskalation(ziel),
    eskalationOhneAlarmAt: planeEskalationOhneAlarm(ziel, jetzt),
    // Nachforderung/Entwarnung gibt es nur beim ersten Eintreffen – danach nicht mehr
    ...planeLageBeimEintreffen(ziel, einsatz.erstesEintreffenAt === undefined),
    empfehlung: ziel.requiredVehicles,
    meldungUnklar: istMeldungUnklar(ziel),
    patienten: passePatientenAn(einsatz, ziel),
    neueMeldung: true,
    meldungen: fuegeMeldungenHinzu(einsatz.meldungen, [{ zeit: jetzt, text: meldung, art: 'eskalation' }]),
  };
}

/** Fügt den Bedarf einer Nachforderung zum Einsatz hinzu (inkl. Lagemeldung). */
export function wendeNachforderungAn(
  einsatz: SpielEinsatz,
  nachforderung: EinsatzNachforderung,
  zeit: number,
  quelle: string,
): SpielEinsatz {
  return {
    ...einsatz,
    requiredVehicles: ergaenzeBedarf(einsatz.requiredVehicles, nachforderung.bedarf),
    reward: einsatz.reward + nachforderung.zusatzBelohnung,
    nachforderungGeplant: false,
    neueMeldung: true,
    meldungen: fuegeMeldungenHinzu(einsatz.meldungen, [{
      zeit,
      text: `${quelle}: ${nachforderung.meldung} Nachforderung: ${formatBedarfsListe(nachforderung.bedarf.map((b) => ({ category: b.category, anzahl: b.amount })))}.`,
      art: 'nachforderung',
    }]),
  };
}

/** Prüft, ob die vorhandenen Fahrzeugtypen alle Anforderungen einer Vorlage grundsätzlich erfüllen können. */
export function istVorlageErfuellbar(vorlage: Pick<EinsatzVorlage, 'requiredVehicles'>, fahrzeugTypen: Array<string | undefined>): boolean {
  return istBedarfGedeckt(vorlage.requiredVehicles, fahrzeugTypen.map((type, index) => ({ id: String(index), type })));
}

/** Zuteilungen, die (noch) zum Einsatz gehören – entlassene Fahrzeuge zählen nicht mehr. */
export const getAktiveZuteilungen = (einsatz: Pick<SpielEinsatz, 'alarmedVehicles'>) =>
  einsatz.alarmedVehicles.filter((assignment) => assignment.freigegebenAt === undefined);

export interface BedarfsAbdeckung {
  category: BedarfsKlasse;
  amount: number;
  /** Anzahl alarmierter Fahrzeuge, die diesen Bedarf decken */
  alarmiert: number;
  /** Davon bereits an der Einsatzstelle */
  vorOrt: number;
}

/**
 * Wie viele der benötigten Fahrzeuge sind einem Einsatz zugeteilt bzw. schon vor Ort?
 * Bei laufendem Transport oder abgeschlossenem Einsatz zählen auch bereits entlassene Fahrzeuge.
 */
export function getBedarfsAbdeckung(
  einsatz: SpielEinsatz,
  fahrzeuge: Array<{ id: string; type?: string }>,
  jetzt: number = Date.now(),
): BedarfsAbdeckung[] {
  const zuteilungen = einsatz.status === 'transport' || einsatz.status === 'abgeschlossen'
    ? einsatz.alarmedVehicles
    : getAktiveZuteilungen(einsatz);
  const zugeteilt = zuteilungen.map((assignment) => ({
    id: assignment.vehicleId,
    type: fahrzeuge.find((fahrzeug) => fahrzeug.id === assignment.vehicleId)?.type,
    angekommen: assignment.arrivalAt <= jetzt,
  }));
  const alarmiert = ordneFahrzeugeBedarfZu(einsatz.requiredVehicles, zugeteilt);
  const vorOrt = ordneFahrzeugeBedarfZu(einsatz.requiredVehicles, zugeteilt.filter((fahrzeug) => fahrzeug.angekommen));
  return einsatz.requiredVehicles.map((bedarf, index) => ({
    category: bedarf.category,
    amount: bedarf.amount,
    alarmiert: alarmiert[index].length,
    vorOrt: vorOrt[index].length,
  }));
}

export interface EinsatzVersorgung {
  abdeckung: BedarfsAbdeckung[];
  /** Was noch alarmiert werden muss */
  fehlendAlarmiert: Array<{ category: BedarfsKlasse; anzahl: number }>;
  /** Was noch nicht an der Einsatzstelle ist */
  fehlendVorOrt: Array<{ category: BedarfsKlasse; anzahl: number }>;
  ausreichendAlarmiert: boolean;
  ausreichendVorOrt: boolean;
}

/** Ist der Einsatz ausreichend versorgt? Grundlage für Anzeige („unterversorgt“) und Vorschlag. */
export function getEinsatzVersorgung(
  einsatz: SpielEinsatz,
  fahrzeuge: Array<{ id: string; type?: string }>,
  jetzt: number = Date.now(),
): EinsatzVersorgung {
  const abdeckung = getBedarfsAbdeckung(einsatz, fahrzeuge, jetzt);
  const fehlendAlarmiert = abdeckung
    .map((eintrag) => ({ category: eintrag.category, anzahl: eintrag.amount - eintrag.alarmiert }))
    .filter((eintrag) => eintrag.anzahl > 0);
  const fehlendVorOrt = abdeckung
    .map((eintrag) => ({ category: eintrag.category, anzahl: eintrag.amount - eintrag.vorOrt }))
    .filter((eintrag) => eintrag.anzahl > 0);
  return {
    abdeckung,
    fehlendAlarmiert,
    fehlendVorOrt,
    ausreichendAlarmiert: fehlendAlarmiert.length === 0,
    ausreichendVorOrt: fehlendVorOrt.length === 0,
  };
}
