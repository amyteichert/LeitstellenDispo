/** Grundeinstellungen der Spiellogik. */
export const GAME_CONFIG = {
  startWacheMaxDriveSeconds: 10,
  averageSpeedKmh: 54,
  maxOpenIncidents: 4,
  incidentGenerationMs: 20000,
  completedIncidentHistoryLimit: 100,
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
