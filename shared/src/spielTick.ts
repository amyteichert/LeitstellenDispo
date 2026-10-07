import {
  eskaliereEinsatz,
  findeEinsatzVorlage,
  fuegeMeldungenHinzu,
  getAktiveZuteilungen,
  istVorlageErfuellbar,
  istWichtigeMeldung,
  reduziereBedarf,
  wendeNachforderungAn,
  type AbgeschlossenerSpielEinsatz,
  type EinsatzEntwarnung,
  type EinsatzMeldung,
  type EinsatzVorlage,
  type SpielEinsatz,
} from './daten.js';
import {
  ergaenzeBedarf,
  formatBedarfsListe,
  getFahrzeugGeschwindigkeit,
  getFehlendenBedarf,
  hatFaehigkeit,
  istBedarfGedeckt,
  ordneFahrzeugeBedarfZu,
} from './fahrzeuge.js';
import { getFahrzeitSekunden, getPositionAufAnfahrt, getStationCoords } from './geo.js';
import { findeZielKrankenhaus, type Krankenhaus } from './krankenhaeuser.js';
import { GAME_CONFIG } from './konfig.js';
import { getTransportStatus, istPatientAbgeschlossen, type Patient } from './patienten.js';
import type { FahrzeugStatus, Koordinaten, MapLocation, Vehicle } from './typen.js';

export interface SpielTickZustand {
  vehicles: Vehicle[];
  incidents: SpielEinsatz[];
  locations: MapLocation[];
  /** Transportziele für Patienten. Ohne Krankenhaus werden Patienten vor Ort übergeben. */
  krankenhaeuser?: Krankenhaus[];
}

export interface SpielTickErgebnis {
  vehicles: Vehicle[];
  /** Laufende Einsätze (abgeschlossene sind bereits entfernt) */
  incidents: SpielEinsatz[];
  /** In diesem Schritt abgeschlossene Einsätze – für Belohnung und Verlauf */
  abgeschlossen: AbgeschlossenerSpielEinsatz[];
  /** Einsätze, die nie alarmiert wurden und nach langer Zeit verschwunden sind */
  verfallen: SpielEinsatz[];
  geaendert: boolean;
}

/** Ein Fahrzeug wird vom Einsatz entlassen und fährt ab `startAt` von `von` zurück zur Wache. */
interface Freigabe {
  vehicleId: string;
  von: Koordinaten;
  startAt: number;
}

interface TickKontext {
  jetzt: number;
  vehicles: Vehicle[];
  locations: MapLocation[];
  krankenhaeuser: Krankenhaus[];
  fahrzeugTypen: Array<string | undefined>;
  freigaben: Freigabe[];
  abgeschlossen: SpielEinsatz[];
  verfallen: SpielEinsatz[];
  geaendert: boolean;
}

const STANDARD_LAGE: Record<SpielEinsatz['organization'], string> = {
  Rettungsdienst: 'Patient wird gesichtet und versorgt.',
  Feuerwehr: 'Erkundung läuft, Lage wie gemeldet.',
};

const funkname = (ctx: TickKontext, vehicleId: string) => {
  const vehicle = ctx.vehicles.find((item) => item.id === vehicleId);
  return vehicle?.callsign ?? vehicle?.name ?? 'Fahrzeug';
};

const typVon = (ctx: TickKontext, vehicleId: string) => ctx.vehicles.find((item) => item.id === vehicleId)?.type;

const meldung = (zeit: number, text: string, art: EinsatzMeldung['art']): EinsatzMeldung => ({ zeit, text, art });

/** Eskalationsziel, falls der Spieler es mit seinen Fahrzeugen überhaupt schaffen kann. */
const findeMachbaresEskalationsziel = (einsatz: SpielEinsatz, ctx: TickKontext) => {
  const eskalation = findeEinsatzVorlage(einsatz.vorlageId)?.eskalation;
  const ziel = eskalation ? findeEinsatzVorlage(eskalation.zielVorlageId) : undefined;
  return eskalation && ziel && istVorlageErfuellbar(ziel, ctx.fahrzeugTypen) ? { eskalation, ziel } : null;
};

/** Eskaliert und begründet ggf. eine Nachforderung, wenn die Fahrzeuge am Einsatz nicht mehr reichen. */
const eskaliere = (einsatz: SpielEinsatz, ziel: EinsatzVorlage, text: string, zeit: number, ctx: TickKontext): SpielEinsatz => {
  const eskaliert = eskaliereEinsatz(einsatz, ziel, text, zeit);
  const zugeteilt = getAktiveZuteilungen(eskaliert).map((a) => ({ id: a.vehicleId, type: typVon(ctx, a.vehicleId) }));
  const fehlend = getFehlendenBedarf(eskaliert.requiredVehicles, zugeteilt);
  if (zugeteilt.length === 0 || fehlend.length === 0) return eskaliert;
  return {
    ...eskaliert,
    meldungen: fuegeMeldungenHinzu(eskaliert.meldungen, [meldung(zeit, `Nachforderung: ${formatBedarfsListe(fehlend)}.`, 'nachforderung')]),
  };
};

/** Gibt ein Fahrzeug frei: vor Ort von der Einsatzstelle aus, noch auf Anfahrt von seiner aktuellen Position. */
const gibFrei = (einsatz: SpielEinsatz, vehicleId: string, zeit: number, ctx: TickKontext, von?: Koordinaten): SpielEinsatz => {
  const assignment = einsatz.alarmedVehicles.find((a) => a.vehicleId === vehicleId);
  if (!assignment || assignment.freigegebenAt !== undefined) return einsatz;
  const wache = getStationCoords(ctx.vehicles.find((v) => v.id === vehicleId)?.stationId, ctx.locations);
  const position = von
    ?? (assignment.arrivalAt <= zeit || !wache ? einsatz.coords : getPositionAufAnfahrt(wache, einsatz.coords, assignment, zeit));
  ctx.freigaben.push({ vehicleId, von: position, startAt: zeit });
  return {
    ...einsatz,
    alarmedVehicles: einsatz.alarmedVehicles.map((a) => (a.vehicleId === vehicleId ? { ...a, freigegebenAt: zeit } : a)),
  };
};

const schliesseAb = (einsatz: SpielEinsatz, zeit: number, ctx: TickKontext): SpielEinsatz => {
  let ergebnis: SpielEinsatz = { ...einsatz, status: 'abgeschlossen', abschlussAt: zeit };
  for (const assignment of getAktiveZuteilungen(ergebnis)) ergebnis = gibFrei(ergebnis, assignment.vehicleId, zeit, ctx);
  ctx.abgeschlossen.push(ergebnis);
  ctx.geaendert = true;
  return ergebnis;
};

/** Einsätze, um die sich (noch) niemand kümmert: Verfall nach langer Zeit oder Eskalation. */
const pruefeUnbearbeitet = (einsatz: SpielEinsatz, ctx: TickKontext): SpielEinsatz => {
  if (ctx.jetzt - einsatz.createdAt >= GAME_CONFIG.einsatzVerfallNachMs) {
    ctx.verfallen.push(einsatz);
    ctx.geaendert = true;
    return einsatz;
  }
  if (einsatz.eskalationOhneAlarmAt !== undefined && ctx.jetzt >= einsatz.eskalationOhneAlarmAt) {
    ctx.geaendert = true;
    const machbar = findeMachbaresEskalationsziel(einsatz, ctx);
    // Lage verschärft sich – nur in Einsätze, die der Spieler überhaupt schaffen kann
    if (machbar) return eskaliere(einsatz, machbar.ziel, machbar.eskalation.meldung, einsatz.eskalationOhneAlarmAt, ctx);
    return { ...einsatz, eskalationOhneAlarmAt: undefined };
  }
  return einsatz;
};

/** Lage kleiner als gemeldet: Bedarf sinkt, überzählige Fahrzeuge (auch noch auf Anfahrt) rücken ab. */
const wendeEntwarnungAn = (
  einsatz: SpielEinsatz,
  entwarnung: EinsatzEntwarnung,
  zeit: number,
  quelle: string,
  ctx: TickKontext,
): SpielEinsatz => {
  const bedarf = reduziereBedarf(einsatz.requiredVehicles, entwarnung.abzug);
  if (bedarf.length === 0) return einsatz;

  // Wer schon vor Ort ist, bleibt bevorzugt am Einsatz
  const zugeteilt = getAktiveZuteilungen(einsatz)
    .sort((a, b) => a.arrivalAt - b.arrivalAt)
    .map((a) => ({ id: a.vehicleId, type: typVon(ctx, a.vehicleId) }));
  const bleiben = new Set(ordneFahrzeugeBedarfZu(bedarf, zugeteilt).flat());

  let ergebnis: SpielEinsatz = {
    ...einsatz,
    requiredVehicles: bedarf,
    meldungen: fuegeMeldungenHinzu(einsatz.meldungen, [meldung(zeit, `${quelle}: ${entwarnung.meldung}`, 'entwarnung')]),
  };
  for (const fahrzeug of zugeteilt) {
    if (!bleiben.has(fahrzeug.id)) ergebnis = gibFrei(ergebnis, fahrzeug.id, zeit, ctx);
  }
  return ergebnis;
};

/** Erstes Fahrzeug an der Einsatzstelle: Lagemeldung und ggf. Nachforderung oder Entwarnung. */
const pruefeErstesEintreffen = (einsatz: SpielEinsatz, ctx: TickKontext): SpielEinsatz => {
  if (einsatz.erstesEintreffenAt !== undefined) return einsatz;
  const erstes = getAktiveZuteilungen(einsatz)
    .filter((a) => a.arrivalAt <= ctx.jetzt)
    .sort((a, b) => a.arrivalAt - b.arrivalAt)[0];
  if (!erstes) return einsatz;

  ctx.geaendert = true;
  const vorlage = findeEinsatzVorlage(einsatz.vorlageId);
  const quelle = funkname(ctx, erstes.vehicleId);
  const zeit = erstes.arrivalAt;
  let ergebnis: SpielEinsatz = {
    ...einsatz,
    erstesEintreffenAt: zeit,
    meldungen: fuegeMeldungenHinzu(einsatz.meldungen, [
      meldung(zeit, `${quelle} vor Ort: ${vorlage?.lage ?? STANDARD_LAGE[einsatz.organization]}`, 'lage'),
    ]),
  };

  const nachforderung = vorlage?.nachforderung;
  if (ergebnis.nachforderungGeplant && nachforderung
    && istVorlageErfuellbar({ requiredVehicles: ergaenzeBedarf(ergebnis.requiredVehicles, nachforderung.bedarf) }, ctx.fahrzeugTypen)) {
    return wendeNachforderungAn(ergebnis, nachforderung, zeit, quelle);
  }
  ergebnis.nachforderungGeplant = false;

  if (ergebnis.entwarnungGeplant && vorlage?.entwarnung) ergebnis = wendeEntwarnungAn(ergebnis, vorlage.entwarnung, zeit, quelle, ctx);
  ergebnis.entwarnungGeplant = false;

  // Der Disponent hat zu wenig geschickt: das erste Fahrzeug fordert nach
  const zugeteilt = getAktiveZuteilungen(ergebnis).map((a) => ({ id: a.vehicleId, type: typVon(ctx, a.vehicleId) }));
  const fehlend = getFehlendenBedarf(ergebnis.requiredVehicles, zugeteilt);
  if (fehlend.length > 0) {
    ergebnis = {
      ...ergebnis,
      neueMeldung: true,
      meldungen: fuegeMeldungenHinzu(ergebnis.meldungen, [
        meldung(zeit, `${quelle}: Kräfte reichen nicht aus – Nachforderung: ${formatBedarfsListe(fehlend)}.`, 'nachforderung'),
      ]),
    };
  }
  return ergebnis;
};

/** Bearbeitung beginnt, sobald der Bedarf durch Fahrzeuge VOR ORT gedeckt ist (nicht schon bei Alarmierung). */
const pruefeBearbeitungsbeginn = (einsatz: SpielEinsatz, ctx: TickKontext): SpielEinsatz => {
  const angekommen = getAktiveZuteilungen(einsatz)
    .filter((a) => a.arrivalAt <= ctx.jetzt)
    .sort((a, b) => a.arrivalAt - b.arrivalAt);

  // Zeitpunkt, ab dem der Bedarf vor Ort erstmals gedeckt war (wichtig beim Nachholen von Offline-Zeit)
  let gedecktAb: number | undefined;
  for (let anzahl = 1; anzahl <= angekommen.length; anzahl += 1) {
    const vorOrt = angekommen.slice(0, anzahl).map((a) => ({ id: a.vehicleId, type: typVon(ctx, a.vehicleId) }));
    if (istBedarfGedeckt(einsatz.requiredVehicles, vorOrt)) {
      gedecktAb = angekommen[anzahl - 1].arrivalAt;
      break;
    }
  }
  if (gedecktAb === undefined) return einsatz;

  // Frühestens ab der letzten Eskalation/Nachforderung – so stimmt die Zeit auch nach einer Lageänderung
  const letzteLageaenderung = Math.max(0, ...einsatz.meldungen.filter(istWichtigeMeldung).map((m) => m.zeit));
  const start = Math.min(ctx.jetzt, Math.max(gedecktAb, letzteLageaenderung));
  ctx.geaendert = true;
  return {
    ...einsatz,
    status: 'in_bearbeitung',
    processingStartedAt: start,
    processingEndsAt: start + einsatz.durationSeconds * 1000,
    patienten: einsatz.patienten?.map((patient) => (patient.status === 'wartet' ? { ...patient, status: 'in_behandlung' } : patient)),
  };
};

/**
 * Ende der Behandlung/Bearbeitung vor Ort.
 * Patienten mit Transportbedarf fahren mit einem RTW ins nächste Krankenhaus, alle anderen Fahrzeuge werden frei.
 */
const beendeBearbeitung = (einsatz: SpielEinsatz, ctx: TickKontext): SpielEinsatz => {
  const ende = einsatz.processingEndsAt ?? ctx.jetzt;
  const transportFahrzeuge = getAktiveZuteilungen(einsatz)
    .filter((a) => a.arrivalAt <= ende && hatFaehigkeit(typVon(ctx, a.vehicleId), 'patiententransport'))
    .map((a) => a.vehicleId);
  const krankenhaus = findeZielKrankenhaus(einsatz.coords, ctx.krankenhaeuser);
  const neueMeldungen: EinsatzMeldung[] = [];

  const patienten = (einsatz.patienten ?? []).map((patient): Patient => {
    if (istPatientAbgeschlossen(patient)) return patient;
    const fahrzeugId = patient.transportErforderlich ? transportFahrzeuge.shift() : undefined;
    if (!patient.transportErforderlich || !fahrzeugId || !krankenhaus) {
      neueMeldungen.push(meldung(ende, patient.transportErforderlich
        ? 'Kein Transportmittel bzw. Krankenhaus verfügbar – Patient vor Ort an den Hausarzt übergeben.'
        : 'Patient vor Ort versorgt, kein Transport erforderlich.', 'patient'));
      return { ...patient, status: 'ambulant' };
    }
    const fahrzeit = getFahrzeitSekunden(einsatz.coords, krankenhaus.coords, getFahrzeugGeschwindigkeit(typVon(ctx, fahrzeugId)));
    const ankunftAt = ende + fahrzeit * 1000;
    neueMeldungen.push(meldung(ende, `${funkname(ctx, fahrzeugId)}: Transport in ${krankenhaus.name}.`, 'patient'));
    return {
      ...patient,
      status: 'transport',
      transport: {
        fahrzeugId,
        krankenhausId: krankenhaus.id,
        krankenhausName: krankenhaus.name,
        ziel: krankenhaus.coords,
        startAt: ende,
        ankunftAt,
        uebergabeBis: ankunftAt + GAME_CONFIG.patientenUebergabeSekunden * 1000,
      },
    };
  });

  const anzahlTransporte = patienten.filter((p) => p.status === 'transport').length;
  let ergebnis: SpielEinsatz = {
    ...einsatz,
    patienten: einsatz.patienten ? patienten : undefined,
    reward: einsatz.reward + anzahlTransporte * GAME_CONFIG.transportVerguetung,
    meldungen: fuegeMeldungenHinzu(einsatz.meldungen, neueMeldungen),
  };
  ctx.geaendert = true;

  const transportierend = new Set(patienten.map((p) => p.transport?.fahrzeugId).filter(Boolean));
  if (transportierend.size === 0) return schliesseAb(ergebnis, ende, ctx);

  // Alle Fahrzeuge, die nicht transportieren (z. B. NEF), fahren schon zurück
  for (const assignment of getAktiveZuteilungen(ergebnis)) {
    if (!transportierend.has(assignment.vehicleId)) ergebnis = gibFrei(ergebnis, assignment.vehicleId, ende, ctx);
  }
  return { ...ergebnis, status: 'transport' };
};

/** Transportfahrt und Übergabe im Krankenhaus; danach ist der RTW frei und der Einsatz abgeschlossen. */
const pruefeTransporte = (einsatz: SpielEinsatz, ctx: TickKontext): SpielEinsatz => {
  let ergebnis = einsatz;
  let patientenGeaendert = false;
  const patienten = (einsatz.patienten ?? []).map((patient): Patient => {
    if (!patient.transport || istPatientAbgeschlossen(patient)) return patient;
    const status = getTransportStatus(patient.transport, ctx.jetzt);
    if (status === patient.status) return patient;
    patientenGeaendert = true;
    ctx.geaendert = true;
    if (status === 'uebergeben') {
      const { fahrzeugId, krankenhausName, ziel, uebergabeBis } = patient.transport;
      ergebnis = gibFrei(ergebnis, fahrzeugId, uebergabeBis, ctx, ziel);
      ergebnis = {
        ...ergebnis,
        meldungen: fuegeMeldungenHinzu(ergebnis.meldungen, [
          meldung(uebergabeBis, `${funkname(ctx, fahrzeugId)}: Patient in ${krankenhausName} übergeben.`, 'patient'),
        ]),
      };
    }
    return { ...patient, status };
  });
  if (patientenGeaendert) ergebnis = { ...ergebnis, patienten };
  if (!patienten.every(istPatientAbgeschlossen)) return ergebnis;

  const letzteUebergabe = Math.max(ergebnis.processingEndsAt ?? 0, ...patienten.map((p) => p.transport?.uebergabeBis ?? 0));
  return schliesseAb(ergebnis, letzteUebergabe, ctx);
};

/** Alle Phasen eines Einsatzes, die bis `jetzt` fällig sind – auch mehrere hintereinander (Offline-Fortschritt). */
const aktualisiereEinsatz = (incident: SpielEinsatz, ctx: TickKontext): SpielEinsatz => {
  if (incident.status === 'abgeschlossen') return incident;

  if (incident.status === 'offen' && incident.alarmedVehicles.length === 0) return pruefeUnbearbeitet(incident, ctx);

  let einsatz = incident;
  if (einsatz.status === 'offen') {
    einsatz = { ...einsatz, status: 'alarmiert' };
    ctx.geaendert = true;
  }

  if (einsatz.status === 'alarmiert') {
    einsatz = pruefeErstesEintreffen(einsatz, ctx);
    if (einsatz.status === 'alarmiert') einsatz = pruefeBearbeitungsbeginn(einsatz, ctx);
  }

  if (einsatz.status === 'in_bearbeitung') {
    const { processingStartedAt, eskalationBei } = einsatz;
    // Lagemeldung von der Einsatzstelle während der Bearbeitung
    const eskalationsZeitpunkt = eskalationBei !== undefined && processingStartedAt
      ? processingStartedAt + eskalationBei * einsatz.durationSeconds * 1000
      : undefined;
    if (eskalationsZeitpunkt !== undefined && ctx.jetzt >= eskalationsZeitpunkt) {
      ctx.geaendert = true;
      const machbar = findeMachbaresEskalationsziel(einsatz, ctx);
      // Nur eskalieren, wenn der Spieler den größeren Einsatz überhaupt schaffen kann
      if (machbar) return eskaliere(einsatz, machbar.ziel, machbar.eskalation.meldung, eskalationsZeitpunkt, ctx);
      einsatz = { ...einsatz, eskalationBei: undefined };
    }
    if (ctx.jetzt >= (einsatz.processingEndsAt ?? Infinity)) einsatz = beendeBearbeitung(einsatz, ctx);
  }

  if (einsatz.status === 'transport') einsatz = pruefeTransporte(einsatz, ctx);

  return einsatz;
};

/** Status, den ein Fahrzeug aufgrund seiner Zuteilung haben muss (oder null ohne Zuteilung). */
const getSollStatus = (vehicle: Vehicle, incidents: SpielEinsatz[], jetzt: number): FahrzeugStatus | null => {
  for (const incident of incidents) {
    if (incident.status === 'abgeschlossen') continue;
    const assignment = getAktiveZuteilungen(incident).find((a) => a.vehicleId === vehicle.id);
    if (!assignment) continue;
    const transport = incident.patienten?.find((p) => p.transport?.fahrzeugId === vehicle.id)?.transport;
    if (transport && jetzt >= transport.startAt) return jetzt < transport.ankunftAt ? 'Patiententransport' : 'Am Krankenhaus';
    return jetzt >= assignment.arrivalAt ? 'Im Einsatz' : 'Alarmiert / auf Anfahrt';
  }
  return null;
};

/**
 * Ein Schritt der Spielzeit: Ankunft, Lagemeldungen, Nachforderung, Bearbeitung, Eskalation,
 * Patiententransport, Abschluss und Rückfahrt.
 * Alle Zeitpunkte werden aus echten Zeitstempeln berechnet – dadurch läuft das Spiel auch weiter,
 * während es geschlossen ist (ein Aufruf mit späterem `jetzt` holt alles nach).
 */
export const berechneSpielTick = (zustand: SpielTickZustand, jetzt: number): SpielTickErgebnis => {
  const { vehicles, incidents, locations } = zustand;
  const ctx: TickKontext = {
    jetzt,
    vehicles,
    locations,
    krankenhaeuser: zustand.krankenhaeuser ?? [],
    fahrzeugTypen: vehicles.filter((vehicle) => vehicle.stationId).map((vehicle) => vehicle.type),
    freigaben: [],
    abgeschlossen: [],
    verfallen: [],
    geaendert: false,
  };

  const nextIncidents = incidents.map((incident) => aktualisiereEinsatz(incident, ctx));

  const nextVehicles = vehicles.map((vehicle): Vehicle => {
    // Vom Einsatz entlassen: Rückfahrt (Luftlinie) zur Wache ab dem echten Freigabezeitpunkt
    const freigabe = ctx.freigaben.find((entry) => entry.vehicleId === vehicle.id);
    if (freigabe) {
      ctx.geaendert = true;
      const wache = getStationCoords(vehicle.stationId, locations);
      if (!wache) return { ...vehicle, status: 'Einsatzbereit', rueckfahrt: undefined };
      const fahrzeit = getFahrzeitSekunden(freigabe.von, wache, getFahrzeugGeschwindigkeit(vehicle.type));
      return {
        ...vehicle,
        status: 'Rückfahrt',
        rueckfahrt: { von: freigabe.von, startAt: freigabe.startAt, ankunftAt: freigabe.startAt + fahrzeit * 1000 },
      };
    }

    const sollStatus = getSollStatus(vehicle, nextIncidents, jetzt);
    if (sollStatus) {
      if (vehicle.status === sollStatus) return vehicle;
      ctx.geaendert = true;
      return { ...vehicle, status: sollStatus };
    }

    // Rückfahrt zur Wache: erst bei Ankunft wieder einsatzbereit
    if (vehicle.rueckfahrt) {
      if (jetzt >= vehicle.rueckfahrt.ankunftAt) {
        ctx.geaendert = true;
        return { ...vehicle, status: 'Einsatzbereit', rueckfahrt: undefined };
      }
      if (vehicle.status !== 'Rückfahrt') {
        ctx.geaendert = true;
        return { ...vehicle, status: 'Rückfahrt' };
      }
      return vehicle;
    }
    if (vehicle.status !== 'Einsatzbereit') {
      ctx.geaendert = true;
      return { ...vehicle, status: 'Einsatzbereit' };
    }
    return vehicle;
  });

  if (!ctx.geaendert) {
    return { vehicles, incidents, abgeschlossen: [], verfallen: [], geaendert: false };
  }

  const abgeschlossen: AbgeschlossenerSpielEinsatz[] = ctx.abgeschlossen.map((incident) => {
    const completedAt = incident.abschlussAt ?? incident.processingEndsAt ?? jetzt;
    return {
      ...incident,
      completedAt,
      totalDurationSeconds: Math.max(1, Math.round((completedAt - (incident.processingStartedAt ?? incident.createdAt)) / 1000)),
    };
  });

  return {
    vehicles: nextVehicles,
    incidents: nextIncidents.filter((incident) => incident.status !== 'abgeschlossen' && !ctx.verfallen.includes(incident)),
    abgeschlossen,
    verfallen: ctx.verfallen,
    geaendert: true,
  };
};
