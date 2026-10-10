/** Grundeinstellungen der Spiellogik. */
export const GAME_CONFIG = {
  startWacheMaxDriveSeconds: 10,
  averageSpeedKmh: 54,
  maxOpenIncidents: 4,
  incidentGenerationMs: 20000,
  completedIncidentHistoryLimit: 100,
  /** Ein nie alarmierter Einsatz verschwindet frühestens nach dieser Zeit */
  einsatzVerfallNachMs: 12 * 60 * 60 * 1000,
  /** Zeitfenster, in dem ein nicht alarmierter Einsatz (evtl.) eskaliert */
  eskalationOhneAlarmMinMs: 2 * 60 * 1000,
  eskalationOhneAlarmMaxMs: 4 * 60 * 1000,
  /** Liegt kein Krankenhaus in diesem Umkreis einer Rettungswache, wird eines angelegt */
  krankenhausEinzugsbereichKm: 20,
  /** Dauer der Patientenübergabe im Krankenhaus */
  patientenUebergabeSekunden: 15,
  /** Vergütung je Patient, der ins Krankenhaus transportiert wird (Transporte werden abgerechnet) */
  transportVerguetung: 120,
  /** Bis die Besatzung im Fahrzeug sitzt und losfährt (Sekunden) */
  ausrueckzeitSekunden: { Rettungsdienst: 30, Feuerwehr: 60 },
  /** Die Arbeit vor Ort dauert so viel länger als die Vorlage angibt (realistischeres Tempo) */
  bearbeitungsFaktor: 4,
};

/** Dauer der Arbeit vor Ort in Millisekunden */
export const getBearbeitungsMs = (einsatz: { durationSeconds: number }) => einsatz.durationSeconds * GAME_CONFIG.bearbeitungsFaktor * 1000;

/**
 * Einsatzdruck: Ab einer gewissen Größe kommen auch Einsätze, für die dem Spieler noch Fahrzeuge fehlen
 * (die er aber an seinen Wachen kaufen könnte). Sie lassen sich an die Nachbarleitstelle abgeben.
 */
export const EINSATZDRUCK_CONFIG = {
  abWachen: 10,
  /** Anteil der neuen Einsätze, die so ein Einsatz sein dürfen */
  anteil: 0.2,
  /** Unbearbeitet übernimmt die Nachbarleitstelle nach dieser Zeit */
  verfallNachMs: 30 * 60 * 1000,
} as const;

/**
 * Einsätze, die nur mit noch unbesetzten Fahrzeugen zu schaffen wären, kommen seltener –
 * als Hinweis, dass Personal fehlt, ohne den Spieler damit zu überschwemmen.
 */
export const UNBESETZT_HAEUFIGKEIT = 0.3;

/** Wie weit neue Einsätze um eine Wache herum entstehen – wächst mit der Anzahl der Wachen. */
export const INCIDENT_SPAWN_CONFIG = {
  earlyPhaseMaxStationCount: 3,
  earlyPhaseMaxRadiusKm: 1.2,
  midPhaseMaxStationCount: 6,
  midPhaseMaxRadiusKm: 3.5,
  latePhaseMaxRadiusKm: 8,
  preferredVehicleMinRadiusKm: 0.15,
} as const;
