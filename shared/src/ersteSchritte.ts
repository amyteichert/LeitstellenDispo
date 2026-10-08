/**
 * „Erste Schritte“ für neue Spieler: kurze Anleitung, deren Fortschritt direkt aus dem Spielstand folgt.
 * Reine Funktion – es wird nichts zusätzlich gespeichert.
 */
import type { AbgeschlossenerSpielEinsatz, SpielEinsatz } from './daten.js';
import type { MapLocation, Vehicle } from './typen.js';

export interface ErsterSchritt {
  id: 'alarmieren' | 'abschliessen' | 'fahrzeug' | 'wache';
  titel: string;
  anleitung: string;
  erledigt: boolean;
}

export interface ErsteSchritteStand {
  incidents: Pick<SpielEinsatz, 'alarmedVehicles'>[];
  completedIncidentHistory: Pick<AbgeschlossenerSpielEinsatz, 'id'>[];
  vehicles: Pick<Vehicle, 'id'>[];
  locations: Pick<MapLocation, 'type'>[];
}

/** Die erste Wache bringt ein Startfahrzeug mit – „weiteres Fahrzeug“ heißt also mehr als eins */
const START_FAHRZEUGE = 1;

export function ermittleErsteSchritte(stand: ErsteSchritteStand): ErsterSchritt[] {
  const abgeschlossen = stand.completedIncidentHistory.length > 0;
  const wachen = stand.locations.filter((location) => location.type === 'station').length;

  return [
    {
      id: 'wache',
      titel: 'Erste Wache bauen',
      anleitung: 'Links bei „Standorte“ eine Adresse suchen oder in die Karte tippen, Wachenart und Startfahrzeug wählen, dann „Standort erstellen“.',
      erledigt: wachen > 0,
    },
    {
      id: 'alarmieren',
      titel: 'Ersten Einsatz alarmieren',
      anleitung: 'Tippe auf einen Einsatz (Karte oder „Einsätze“), wähle ein passendes Fahrzeug aus und tippe auf „Alarmieren“.',
      erledigt: abgeschlossen || stand.incidents.some((incident) => incident.alarmedVehicles.length > 0),
    },
    {
      id: 'abschliessen',
      titel: 'Einsatz abschließen',
      anleitung: 'Das Fahrzeug fährt hin und arbeitet den Einsatz ab. Dafür bekommst du Geld und dein Ruf steigt.',
      erledigt: abgeschlossen,
    },
    {
      id: 'fahrzeug',
      titel: 'Weiteres Fahrzeug kaufen',
      anleitung: 'Unter „Wachen“ › „Verwalten“ › „Fahrzeuge“. Jedes Fahrzeug braucht einen freien Stellplatz und Personal.',
      erledigt: stand.vehicles.length > START_FAHRZEUGE,
    },
  ];
}
