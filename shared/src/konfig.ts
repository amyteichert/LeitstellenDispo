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
};

/** Wie weit neue Einsätze um eine Wache herum entstehen – wächst mit der Anzahl der Wachen. */
export const INCIDENT_SPAWN_CONFIG = {
  earlyPhaseMaxStationCount: 3,
  earlyPhaseMaxRadiusKm: 1.2,
  midPhaseMaxStationCount: 6,
  midPhaseMaxRadiusKm: 3.5,
  latePhaseMaxRadiusKm: 8,
  preferredVehicleMinRadiusKm: 0.15,
} as const;
