import { Fragment, useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { type LeafletMouseEvent } from 'leaflet';
import {
  APP_VERSION,
  EINSATZ_VORLAGEN,
  eskaliereEinsatz,
  findeEinsatzVorlage,
  planeEskalation,
  START_GUTHABEN,
  WACHEN_PREISE,
  getFahrzeugKategorie,
  getFahrzeugTyp,
  getFahrzeugTypenFuerWache,
  istVorlageErfuellbar,
  formatEinsatzTitel,
  type AbgeschlossenerSpielEinsatz,
  type AlarmiertesFahrzeug,
  type EinsatzVorlage,
  type SpielEinsatz,
} from '@leitstellendispo/shared';
import 'leaflet/dist/leaflet.css';
import './App.css';

import ViewDropdown from './ViewDropdown';

import type { FinanceTransaction, MapLocation, LocationType } from './types';
import { SPIELSTAND_VERSION, spielstandSpeicher, type Spielstand } from './spielstand';
import FahrzeugeView, { type Vehicle } from './views/FahrzeugeView';
import WachenView from './views/WachenView';
import EinsaetzeView from './views/EinsaetzeView';
import { KarteEinsatzLeiste, KarteEinsatzPanel } from './views/KarteEinsatzOverlay';
import FinanzenView from './views/FinanzenView';
import EinstellungenView from './views/EinstellungenView';

const initialLocations: MapLocation[] = [
  {
    id: 'rettungswache-zentrum',
    name: 'Rettungswache Zentrum',
    type: 'station',
    stationKind: 'Rettungswache',
    coords: [48.775, 9.1771],
    description: 'Rettungsdienst',
    details: 'Frei platzierbarer Standort',
    price: 0,
  },
  {
    id: 'rettungswache-sued',
    name: 'Rettungswache Süd',
    type: 'station',
    stationKind: 'Rettungswache',
    coords: [48.7692, 9.1931],
    description: 'Rettungsdienst',
    details: 'Frei platzierbarer Standort',
    price: 0,
  },
];

/** Startzustand für ein neues Spiel: zwei Rettungswachen mit einem RTW und Startguthaben. */
const createNeuesSpiel = (): Spielstand => ({
  version: SPIELSTAND_VERSION,
  gespeichertAm: new Date().toISOString(),
  balance: START_GUTHABEN,
  transactions: [
    { id: 'initial-balance', kind: 'Einnahme', label: 'Startguthaben', amount: START_GUTHABEN, createdAt: new Date().toISOString() },
  ],
  locations: initialLocations,
  vehicles: [
    { id: 'fahrzeug-1', name: 'RTW 1', type: 'RTW', stationId: 'rettungswache-zentrum', price: 0, callsign: 'RTW-1', status: 'Einsatzbereit' },
  ],
  incidents: [],
  completedIncidentHistory: [],
});

const createMarkerIcon = (color: string) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<span style="display:block; width:16px; height:16px; border-radius:50%; background:${color}; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.25);"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const INCIDENT_MARKER_COLORS: Record<SpielEinsatz['status'], string> = {
  offen: '#f59e0b',
  alarmiert: '#3b82f6',
  in_bearbeitung: '#c41e3a',
  abgeschlossen: '#6b7280',
};

/** Einsatz-Marker in Statusfarbe; offene Einsätze pulsieren, der gewählte ist größer. */
const createIncidentMarkerIcon = (status: SpielEinsatz['status'], selected: boolean) => {
  const size = selected ? 22 : 16;
  return L.divIcon({
    className: `custom-marker incident-marker incident-marker--${status}`,
    html: `<span style="display:block; width:${size}px; height:${size}px; border-radius:50%; background:${INCIDENT_MARKER_COLORS[status]}; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.25);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const GAME_CONFIG = {
  startWacheMaxDriveSeconds: 10,
  averageSpeedKmh: 54,
  maxOpenIncidents: 4,
  incidentGenerationMs: 20000,
  completedIncidentHistoryLimit: 100,
};

const INCIDENT_SPAWN_CONFIG = {
  earlyPhaseMaxStationCount: 3,
  earlyPhaseMaxRadiusKm: 1.2,
  midPhaseMaxStationCount: 6,
  midPhaseMaxRadiusKm: 3.5,
  latePhaseMaxRadiusKm: 8,
  preferredVehicleMinRadiusKm: 0.15,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const haversineKm = (from: [number, number], to: [number, number]) => {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRadians(from[0]);
  const lat2 = toRadians(to[0]);
  const dLat = toRadians(to[0] - from[0]);
  const dLng = toRadians(to[1] - from[1]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

/** Fahrzeit in Sekunden auf der Luftlinie (später durch echtes Straßen-Routing ersetzen). */
const getFahrzeitSekunden = (from: [number, number], to: [number, number]) =>
  Math.max(1, Math.round((haversineKm(from, to) / GAME_CONFIG.averageSpeedKmh) * 3600));

/** Aktuelle Position eines Fahrzeugs unterwegs – oder null, wenn es an der Wache steht. */
const getFahrzeugPosition = (
  vehicle: Vehicle,
  incidents: SpielEinsatz[],
  locations: MapLocation[],
  nowMs: number,
): { position: [number, number]; ziel: [number, number]; unterwegs: boolean } | null => {
  const wache = getStationCoords(vehicle.stationId, locations);
  if (!wache) return null;

  const interpoliere = (von: [number, number], nach: [number, number], startAt: number, ankunftAt: number): [number, number] => {
    const anteil = clamp((nowMs - startAt) / Math.max(1, ankunftAt - startAt), 0, 1);
    return [von[0] + (nach[0] - von[0]) * anteil, von[1] + (nach[1] - von[1]) * anteil];
  };

  if (vehicle.rueckfahrt) {
    const { von, startAt, ankunftAt } = vehicle.rueckfahrt;
    return { position: interpoliere(von, wache, startAt, ankunftAt), ziel: wache, unterwegs: nowMs < ankunftAt };
  }

  for (const incident of incidents) {
    const assignment = incident.alarmedVehicles.find((entry) => entry.vehicleId === vehicle.id);
    if (!assignment || incident.status === 'abgeschlossen') continue;
    const startAt = assignment.arrivalAt - assignment.etaSeconds * 1000;
    return {
      position: interpoliere(wache, incident.coords, startAt, assignment.arrivalAt),
      ziel: incident.coords,
      unterwegs: nowMs < assignment.arrivalAt,
    };
  }

  return null;
};

const createVehicleMarkerIcon = (label: string, rueckfahrt: boolean) =>
  L.divIcon({
    className: `vehicle-marker ${rueckfahrt ? 'vehicle-marker--rueckfahrt' : ''}`,
    html: `<span>${label}</span>`,
    iconSize: undefined,
    iconAnchor: [0, 0],
  });

const getStationCoords = (stationId: string | undefined, locations: MapLocation[]) => {
  if (!stationId) return null;
  const found = locations.find((location) => location.id === stationId && location.type === 'station');
  return found ? found.coords : null;
};

const getAvailableIncidentTemplates = (stationKind: 'Rettungswache' | 'Feuerwache' | undefined, vehicles: Vehicle[]): EinsatzVorlage[] => {
  // Nur Vorlagen, die der Spieler mit seinen stationierten Fahrzeugen grundsätzlich schaffen kann
  const fahrzeugTypen = vehicles.filter((vehicle) => vehicle.stationId).map((vehicle) => vehicle.type);
  const templates = EINSATZ_VORLAGEN[stationKind ?? 'Rettungswache'] ?? EINSATZ_VORLAGEN.Rettungswache;
  return templates.filter((template) => istVorlageErfuellbar(template, fahrzeugTypen));
};

const getIncidentSpawnRadiusKm = (stationCount: number) => {
  if (stationCount <= INCIDENT_SPAWN_CONFIG.earlyPhaseMaxStationCount) {
    return Math.random() * INCIDENT_SPAWN_CONFIG.earlyPhaseMaxRadiusKm;
  }
  if (stationCount <= INCIDENT_SPAWN_CONFIG.midPhaseMaxStationCount) {
    return INCIDENT_SPAWN_CONFIG.earlyPhaseMaxRadiusKm + Math.random() * (INCIDENT_SPAWN_CONFIG.midPhaseMaxRadiusKm - INCIDENT_SPAWN_CONFIG.earlyPhaseMaxRadiusKm);
  }
  return INCIDENT_SPAWN_CONFIG.midPhaseMaxRadiusKm + Math.random() * (INCIDENT_SPAWN_CONFIG.latePhaseMaxRadiusKm - INCIDENT_SPAWN_CONFIG.midPhaseMaxRadiusKm);
};

const getBestIncidentStation = (
  stations: MapLocation[],
  template: EinsatzVorlage,
  vehicles: Vehicle[],
) => {
  const matchingStations = stations
    .map((station) => {
      const matchingVehicles = vehicles.filter(
        (vehicle) =>
          vehicle.stationId === station.id &&
          vehicle.status === 'Einsatzbereit' &&
          getFahrzeugKategorie(vehicle.type) === template.requiredVehicles[0]?.category,
      );
      return { station, matchingVehicles: matchingVehicles.length };
    })
    .filter((entry) => entry.matchingVehicles > 0)
    .sort((a, b) => b.matchingVehicles - a.matchingVehicles);

  if (matchingStations.length > 0) {
    const bestScore = matchingStations[0].matchingVehicles;
    const candidates = matchingStations.filter((entry) => entry.matchingVehicles === bestScore);
    return candidates[Math.floor(Math.random() * candidates.length)].station;
  }

  return stations[Math.floor(Math.random() * stations.length)];
};

const getRandomCoordsAroundStation = (station: MapLocation, stationCount: number): [number, number] => {
  const maxRadiusKm = getIncidentSpawnRadiusKm(stationCount);
  const distanceKm = clamp(
    maxRadiusKm * (0.3 + Math.random() * 0.7),
    INCIDENT_SPAWN_CONFIG.preferredVehicleMinRadiusKm,
    maxRadiusKm,
  );

  const angle = Math.random() * Math.PI * 2;
  const latShift = (distanceKm / 111.32) * Math.cos(angle);
  const lngShift = (distanceKm / (111.32 * Math.cos((station.coords[0] * Math.PI) / 180))) * Math.sin(angle);

  return [clamp(station.coords[0] + latShift, 47.5, 55.2), clamp(station.coords[1] + lngShift, 7.5, 14.9)];
};

const createSpielEinsatz = (
  template: EinsatzVorlage,
  station: MapLocation,
  coords: [number, number],
  address: string,
): SpielEinsatz => ({
  id: `incident-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  stichwort: template.stichwort,
  meldebild: template.meldebild,
  organization: template.organization,
  status: 'offen',
  coords,
  address,
  generatedByStationId: station.id,
  generatedByStationName: station.name,
  requiredVehicles: template.requiredVehicles,
  alarmedVehicles: [],
  reward: template.reward,
  durationSeconds: template.durationSeconds,
  createdAt: Date.now(),
  vorlageId: template.id,
  meldungen: [],
  eskalationBei: planeEskalation(template),
});

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (event: LeafletMouseEvent) => void;
}) {
  useMapEvents({
    click: (event) => onMapClick(event),
  });

  return null;
}

/** Knopf unten rechts auf der Karte, als echtes Leaflet-Bedienelement (stapelt sich über der Quellenangabe). */
function MapStyleToggle({
  mapStyle,
  onToggle,
}: {
  mapStyle: 'karte' | 'satellit';
  onToggle: () => void;
}) {
  const map = useMap();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const control = new L.Control({ position: 'bottomright' });
    control.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-control');
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    control.addTo(map);
    setContainer(control.getContainer() ?? null);
    return () => {
      control.remove();
    };
  }, [map]);

  if (!container) return null;

  return createPortal(
    <button type="button" className="map-style-toggle" onClick={onToggle}>
      {mapStyle === 'karte' ? '🛰️ Satellit' : '🗺️ Karte'}
    </button>,
    container,
  );
}

function App() {
  const [startSpiel] = useState(createNeuesSpiel);
  const [locations, setLocations] = useState<MapLocation[]>(startSpiel.locations);
  const [selectedId, setSelectedId] = useState<string>(initialLocations[0].id);
  const [draftName, setDraftName] = useState('Neue Rettungswache');
  const [draftType, setDraftType] = useState<LocationType>('station');

  const [vehicles, setVehicles] = useState<Vehicle[]>(startSpiel.vehicles);

  // Finances
  const [balance, setBalance] = useState<number>(startSpiel.balance);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(startSpiel.transactions);

  const addTransaction = (kind: FinanceTransaction['kind'], label: string, amount: number) => {
    setTransactions((cur) => [{
      id: `txn-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind,
      label,
      amount,
      createdAt: new Date().toISOString(),
    }, ...cur]);
  };

  // helper: add vehicle
  const addVehicle = (v: Omit<Vehicle, 'id'>) => {
    const id = `fahrzeug-${Date.now()}`;
    setVehicles((cur) => [...cur, { ...v, id, status: v.status ?? 'Einsatzbereit' }]);
  };

  const buyVehicle = (stationId: string, typ: string) => {
    const station = locations.find((location) => location.id === stationId && location.type === 'station');
    const fahrzeugTyp = getFahrzeugTyp(typ);
    if (!station || !fahrzeugTyp) return;
    if (fahrzeugTyp.wachenArt !== (station.stationKind ?? 'Rettungswache')) {
      alert(`${typ} passt nicht zu einer ${station.stationKind ?? 'Rettungswache'}.`);
      return;
    }
    if (balance < fahrzeugTyp.preis) {
      alert(`Nicht genügend Guthaben. Benötigt: ${fahrzeugTyp.preis} €, verfügbar: ${balance} €.`);
      return;
    }

    const nummer = vehicles.filter((vehicle) => vehicle.type === typ).length + 1;
    setBalance((cur) => cur - fahrzeugTyp.preis);
    addTransaction('Ausgabe', `${typ} für ${station.name} gekauft`, fahrzeugTyp.preis);
    addVehicle({
      name: typ,
      type: typ,
      stationId,
      price: fahrzeugTyp.preis,
      callsign: `${typ.replace(/\s+/g, '')}-${nummer}`,
    });
  };

  const [incidents, setIncidents] = useState<SpielEinsatz[]>(startSpiel.incidents);
  const [completedIncidentHistory, setCompletedIncidentHistory] = useState<AbgeschlossenerSpielEinsatz[]>(startSpiel.completedIncidentHistory);
  // Erst nach dem Laden wird gespeichert und werden Einsätze erzeugt (sonst würde ein leerer Stand den gespeicherten überschreiben)
  const [spielstandGeladen, setSpielstandGeladen] = useState(false);

  const spielstandAnwenden = (spielstand: Spielstand) => {
    setBalance(spielstand.balance);
    setTransactions(spielstand.transactions);
    setLocations(spielstand.locations);
    setVehicles(spielstand.vehicles);
    setIncidents(spielstand.incidents);
    setCompletedIncidentHistory(spielstand.completedIncidentHistory);
    setSelectedId(spielstand.locations[0]?.id ?? '');
    setSelectedIncidentId(null);
    setMapIncidentId(null);
  };

  // Spielstand beim Start laden
  useEffect(() => {
    let abgebrochen = false;
    spielstandSpeicher.laden().then((spielstand) => {
      if (abgebrochen) return;
      if (spielstand) spielstandAnwenden(spielstand);
      setSpielstandGeladen(true);
    });
    return () => {
      abgebrochen = true;
    };
  }, []);

  // Spielstand automatisch speichern (kurz verzögert, damit nicht bei jeder Kleinigkeit geschrieben wird)
  useEffect(() => {
    if (!spielstandGeladen) return;
    const timeout = setTimeout(() => {
      spielstandSpeicher.speichern({
        version: SPIELSTAND_VERSION,
        gespeichertAm: new Date().toISOString(),
        balance,
        transactions,
        locations,
        vehicles,
        incidents,
        completedIncidentHistory,
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [spielstandGeladen, balance, transactions, locations, vehicles, incidents, completedIncidentHistory]);

  const neuesSpiel = () => {
    if (!confirm('Wirklich ein neues Spiel starten? Der aktuelle Spielstand wird gelöscht.')) return;
    spielstandSpeicher.loeschen();
    spielstandAnwenden(createNeuesSpiel());
    setCurrentView('Karte');
  };
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  // New states for address search and preview behavior
  const [address, setAddress] = useState('');
  const [geocodeResults, setGeocodeResults] = useState<Array<any>>([]);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [tempCoords, setTempCoords] = useState<[number, number] | null>(null);
  const [selectedGeocodeIndex, setSelectedGeocodeIndex] = useState<number | null>(null);
  // map reference to allow programmatic centering when selecting geocode results
  const mapRef = useRef<any>(null);
  const [mapStyle, setMapStyle] = useState<'karte' | 'satellit'>('karte');
  // Einsatz, dessen Kurzinfo gerade als schwebendes Fenster auf der Karte angezeigt wird
  const [mapIncidentId, setMapIncidentId] = useState<string | null>(null);
  // Standorte-Leiste auf dem Handy ein-/ausgeklappt (am PC immer sichtbar)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // new state: choose station kind when creating a station
  const [draftStationKind, setDraftStationKind] = useState<'Rettungswache' | 'Feuerwache'>('Rettungswache');
  // start vehicle selection (exactly one) and callsign
  const [draftStartVehicleType, setDraftStartVehicleType] = useState<string>('RTW');
  const [draftStartVehicleCallsign, setDraftStartVehicleCallsign] = useState<string>('');

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!spielstandGeladen) return;
    const stationPool = locations.filter((location) => location.type === 'station');
    if (stationPool.length === 0) return;
    if (incidents.filter((incident) => incident.status !== 'abgeschlossen').length >= GAME_CONFIG.maxOpenIncidents) return;

    const interval = setInterval(() => {
      setIncidents((current) => {
        if (current.filter((incident) => incident.status !== 'abgeschlossen').length >= GAME_CONFIG.maxOpenIncidents) {
          return current;
        }

        const activeStations = locations.filter((location) => location.type === 'station');
        if (activeStations.length === 0) return current;

        const stationKind = activeStations[Math.floor(Math.random() * activeStations.length)].stationKind;
        const templates = getAvailableIncidentTemplates(stationKind, vehicles);
        if (templates.length === 0) return current;
        const template = templates[Math.floor(Math.random() * templates.length)];
        const station = getBestIncidentStation(activeStations, template, vehicles);
        const coords = getRandomCoordsAroundStation(station, activeStations.length);

        const nextIncident = createSpielEinsatz(template, station, coords, `${template.meldebild} in der Nähe von ${station.name}`);

        return [nextIncident, ...current];
      });
    }, GAME_CONFIG.incidentGenerationMs);

    return () => clearInterval(interval);
  }, [spielstandGeladen, locations, incidents, vehicles]);

  useEffect(() => {
    setDraftStartVehicleType(getFahrzeugTypenFuerWache(draftStationKind)[0]?.typ ?? '');
  }, [draftStationKind]);

  useEffect(() => {
    let changed = false;
    let nextVehicles: Vehicle[] = vehicles.map((vehicle): Vehicle => {
      const activeIncident = incidents.find(
        (incident) => incident.status !== 'abgeschlossen' && incident.alarmedVehicles.some((entry) => entry.vehicleId === vehicle.id),
      );

      if (!activeIncident) {
        // Rückfahrt zur Wache: erst bei Ankunft wieder einsatzbereit
        if (vehicle.rueckfahrt) {
          if (nowMs >= vehicle.rueckfahrt.ankunftAt) {
            changed = true;
            return { ...vehicle, status: 'Einsatzbereit', rueckfahrt: undefined };
          }
          if (vehicle.status !== 'Rückfahrt') {
            changed = true;
            return { ...vehicle, status: 'Rückfahrt' };
          }
          return vehicle;
        }
        if (vehicle.status !== 'Einsatzbereit') {
          changed = true;
          return { ...vehicle, status: 'Einsatzbereit' };
        }
        return vehicle;
      }

      const assignment = activeIncident.alarmedVehicles.find((entry) => entry.vehicleId === vehicle.id);
      if (!assignment) return vehicle;
      if (nowMs >= assignment.arrivalAt && vehicle.status !== 'Im Einsatz') {
        changed = true;
        return { ...vehicle, status: 'Im Einsatz' };
      }
      if (nowMs < assignment.arrivalAt && vehicle.status !== 'Alarmiert / auf Anfahrt') {
        changed = true;
        return { ...vehicle, status: 'Alarmiert / auf Anfahrt' };
      }
      return vehicle;
    });

    const completed: SpielEinsatz[] = [];
    const nextIncidents: SpielEinsatz[] = incidents.map((incident): SpielEinsatz => {
      if (incident.status === 'abgeschlossen') return incident;

      const activeVehicles = incident.alarmedVehicles
        .map((assignment) => nextVehicles.find((vehicle) => vehicle.id === assignment.vehicleId))
        .filter((vehicle): vehicle is Vehicle => Boolean(vehicle));

      const requirementSatisfied = incident.requiredVehicles.every((requirement) => {
        const matches = activeVehicles.filter((vehicle) => getFahrzeugKategorie(vehicle.type) === requirement.category).length;
        return matches >= requirement.amount;
      });

      const allArrived = incident.alarmedVehicles.every((assignment) => nowMs >= assignment.arrivalAt);
      let updated = { ...incident };

      if (incident.alarmedVehicles.length > 0 && incident.status === 'offen') {
        updated.status = 'alarmiert';
        changed = true;
      }

      if (updated.status === 'alarmiert' && requirementSatisfied && allArrived && !updated.processingStartedAt) {
        // Echte Startzeit: Ankunft des letzten Fahrzeugs (frühestens ab der letzten Lagemeldung).
        // So läuft die Bearbeitung auch korrekt weiter, während das Spiel geschlossen war.
        const letzteAnkunft = Math.max(...updated.alarmedVehicles.map((assignment) => assignment.arrivalAt));
        const letzteMeldung = updated.meldungen[updated.meldungen.length - 1]?.zeit ?? 0;
        const startZeit = Math.min(nowMs, Math.max(letzteAnkunft, letzteMeldung));
        updated.status = 'in_bearbeitung';
        updated.processingStartedAt = startZeit;
        updated.processingEndsAt = startZeit + updated.durationSeconds * 1000;
        changed = true;
      }

      if (updated.status === 'in_bearbeitung') {
        if (!updated.processingEndsAt) {
          updated.processingEndsAt = nowMs + updated.durationSeconds * 1000;
        }

        // Eskalation: Lagemeldung von der Einsatzstelle während der Bearbeitung
        const eskalationsZeitpunkt = updated.eskalationBei !== undefined && updated.processingStartedAt
          ? updated.processingStartedAt + updated.eskalationBei * updated.durationSeconds * 1000
          : undefined;
        if (eskalationsZeitpunkt !== undefined && nowMs >= eskalationsZeitpunkt) {
          const eskalation = findeEinsatzVorlage(updated.vorlageId)?.eskalation;
          const ziel = eskalation ? findeEinsatzVorlage(eskalation.zielVorlageId) : undefined;
          const fahrzeugTypen = nextVehicles.filter((vehicle) => vehicle.stationId).map((vehicle) => vehicle.type);
          changed = true;
          // Nur eskalieren, wenn der Spieler den größeren Einsatz überhaupt schaffen kann
          if (eskalation && ziel && istVorlageErfuellbar(ziel, fahrzeugTypen)) {
            return eskaliereEinsatz(updated, ziel, eskalation.meldung, eskalationsZeitpunkt);
          }
          updated.eskalationBei = undefined;
        }

        if (nowMs >= updated.processingEndsAt) {
          updated.status = 'abgeschlossen';
          completed.push(updated);
          changed = true;
        }
      }

      return updated;
    });

    if (completed.length > 0) {
      const completedHistoryEntries = completed.map((incident) => ({
        ...incident,
        completedAt: incident.processingEndsAt ?? nowMs,
        totalDurationSeconds: Math.max(
          1,
          Math.round(((incident.processingEndsAt ?? nowMs) - (incident.processingStartedAt ?? incident.createdAt)) / 1000),
        ),
      })) satisfies AbgeschlossenerSpielEinsatz[];

      setCompletedIncidentHistory((current) => [
        ...completedHistoryEntries,
        ...current,
      ].slice(0, GAME_CONFIG.completedIncidentHistoryLimit));

      setBalance((cur) => cur + completed.reduce((sum, incident) => sum + incident.reward, 0));
      completed.forEach((incident) => addTransaction('Einnahme', `${incident.organization} – ${formatEinsatzTitel(incident)} abgeschlossen`, incident.reward));

      // Fahrzeuge der abgeschlossenen Einsätze fahren (Luftlinie) zurück zur Wache
      nextVehicles = nextVehicles.map((vehicle) => {
        const einsatz = completed.find((incident) =>
          incident.alarmedVehicles.some((assignment) => assignment.vehicleId === vehicle.id),
        );
        if (!einsatz) return vehicle;
        const wache = getStationCoords(vehicle.stationId, locations);
        if (!wache) return { ...vehicle, status: 'Einsatzbereit' };
        return {
          ...vehicle,
          status: 'Rückfahrt',
          // Rückfahrt ab dem echten Einsatzende (auch wenn das Spiel zwischendurch geschlossen war)
          rueckfahrt: (() => {
            const startAt = einsatz.processingEndsAt ?? nowMs;
            return { von: einsatz.coords, startAt, ankunftAt: startAt + getFahrzeitSekunden(einsatz.coords, wache) * 1000 };
          })(),
        };
      });
      changed = true;
      setIncidents((current) => current.filter((incident) => !completed.some((item) => item.id === incident.id)));
      setSelectedIncidentId((current) => (current && completed.some((incident) => incident.id === current) ? null : current));
    }

    if (changed) {
      setVehicles(nextVehicles);
      setIncidents(nextIncidents.filter((incident) => incident.status !== 'abgeschlossen'));
    }
  }, [incidents, vehicles, nowMs, locations]);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedId) ?? locations[0],
    [locations, selectedId],
  );

  const completedIncidentStats = useMemo(() => {
    const total = completedIncidentHistory.length;
    const rettungsdienst = completedIncidentHistory.filter((incident) => incident.organization === 'Rettungsdienst').length;
    const feuerwehr = completedIncidentHistory.filter((incident) => incident.organization === 'Feuerwehr').length;
    const earned = completedIncidentHistory.reduce((sum, incident) => sum + incident.reward, 0);
    return { total, rettungsdienst, feuerwehr, earned };
  }, [completedIncidentHistory]);

  // Navigation / view state (default: Karte)
  const [currentView, setCurrentView] = useState<'Karte'|'Wachen'|'Fahrzeuge'|'Einsätze'|'Finanzen'|'Einstellungen'>('Karte');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);

  const selectView = (v: typeof currentView) => {
    setCurrentView(v);
  };

  const handleMapClick = (event: LeafletMouseEvent) => {
    // Move temporary preview marker to clicked position; do NOT create a location
    const coords: [number, number] = [event.latlng.lat, event.latlng.lng];
    setTempCoords(coords);
    setSelectedGeocodeIndex(null);
    setGeocodeResults([]);
    setGeocodeError(null);
  };

  const geocodeAddress = async (q: string) => {
      if (!q.trim()) {
        setGeocodeError('Bitte eine Adresse eingeben.');
        return;
      }
      setGeocodeLoading(true);
      setGeocodeError(null);
      setGeocodeResults([]);
      setSelectedGeocodeIndex(null);

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=5`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Geocoding konnte nicht durchgeführt werden (Netzwerkfehler).');
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          setGeocodeError('Adresse nicht gefunden.');
          setGeocodeLoading(false);
          return;
        }
        setGeocodeResults(data);
        // Choose the first sensible result as preview
        const first = data[0];
        const coords: [number, number] = [parseFloat(first.lat), parseFloat(first.lon)];
        setTempCoords(coords);
        setSelectedGeocodeIndex(0);
        // center map on the preview if map is available
        try {
          mapRef.current?.setView(coords, mapRef.current.getZoom?.() ?? 13);
        } catch (e) {
          // ignore if mapRef not ready
        }
      } catch (err: any) {
        setGeocodeError(err?.message ?? 'Unbekannter Fehler bei der Adresssuche.');
      } finally {
        setGeocodeLoading(false);
      }
    };

  const createLocationFromTemp = () => {
    const coords = tempCoords;
    if (!coords) {
      alert('Keine Position ausgewählt. Bitte Adresse suchen oder auf die Karte klicken, um eine Vorschau zu setzen.');
      return;
    }

    const stationPrice = WACHEN_PREISE[draftStationKind] ?? 0;
    const vehiclePrice = getFahrzeugTyp(draftStartVehicleType)?.preis ?? 0;
    const totalCost = stationPrice + vehiclePrice;

    if (balance < totalCost) {
      alert(`Nicht genügend Guthaben für die Erstellung. Benötigt: ${totalCost} €, verfügbar: ${balance} €.`);
      return;
    }

    const name = draftName.trim() || 'Neuer Standort';
    const locationId = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const nextLocation: MapLocation = {
      id: locationId,
      name,
      type: draftType,
      stationKind: draftStationKind,
      coords,
      description: draftStationKind === 'Feuerwache' ? 'Feuerwehr' : 'Rettungsdienst',
      details: address.trim() || `Frei platzierbare ${draftStationKind}`,
      price: stationPrice,
    };

    setLocations((current) => [...current, nextLocation]);
    setSelectedId(locationId);
    setBalance((cur) => cur - totalCost);
    addTransaction('Ausgabe', `${draftStationKind} mit ${draftStartVehicleType} erstellt`, totalCost);

    // create the selected start vehicle (exactly one) and assign to the new station
    if (draftStartVehicleType) {
      const callsign = draftStartVehicleCallsign?.trim() || `${draftStartVehicleType} ${Date.now().toString().slice(-4)}`;
      const vehicle: Omit<Vehicle, 'id'> = {
        name: draftStartVehicleType,
        type: draftStartVehicleType,
        stationId: locationId,
        price: vehiclePrice,
        callsign,
      };
      addVehicle(vehicle);
      setDraftStartVehicleCallsign('');
    }

    // clear temp preview and address/choices
    setTempCoords(null);
    setAddress('');
    setGeocodeResults([]);
    setSelectedGeocodeIndex(null);
  };

  const deleteLocation = (id: string) => {
    const stationVehicles = vehicles.filter((vehicle) => vehicle.stationId === id);
    if (stationVehicles.length > 0) {
      alert('Dieser Standort kann nicht gelöscht werden, solange ihm noch Fahrzeuge zugewiesen sind.');
      return;
    }

    if (!confirm('Standort wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;

    setLocations((current) => {
      const next = current.filter((loc) => loc.id !== id);
      // Wenn die gelöschte Location aktuell ausgewählt war, wähle die erste verbleibende
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? '');
      }
      return next;
    });
  };

  const triggerTestIncident = () => {
    const stationPool = locations.filter((location) => location.type === 'station');
    if (stationPool.length === 0) {
      alert('Bitte erst eine Wache erstellen.');
      return;
    }

    const stationKind = stationPool[Math.floor(Math.random() * stationPool.length)].stationKind;
    const templates = getAvailableIncidentTemplates(stationKind, vehicles);
    if (templates.length === 0) {
      alert('Für diese Wache gibt es aktuell keinen Einsatz, den deine Fahrzeuge schaffen können.');
      return;
    }
    const template = templates[Math.floor(Math.random() * templates.length)];
    const station = getBestIncidentStation(stationPool, template, vehicles);
    const coords = getRandomCoordsAroundStation(station, stationPool.length);

    const newIncident = createSpielEinsatz(template, station, coords, `${template.meldebild} in ${station.name}`);

    setIncidents((current) => [newIncident, ...current]);
    setSelectedIncidentId(newIncident.id);
    setCurrentView('Einsätze');
  };

  const markiereMeldungGelesen = (incidentId: string) => {
    setIncidents((current) => current.map((incident) => (
      incident.id === incidentId ? { ...incident, neueMeldung: false } : incident
    )));
  };

  const alarmIncidentVehicles = (incidentId: string, selectedVehicleIds: string[]) => {
    if (selectedVehicleIds.length === 0) return;

    setIncidents((current) => current.map((incident) => {
      if (incident.id !== incidentId) return incident;
      // (Nach-)Alarmierung nur, solange der Einsatz noch nicht bearbeitet wird
      if (incident.status !== 'offen' && incident.status !== 'alarmiert') return incident;

      const vehiclesToAssign = selectedVehicleIds
        .map((vehicleId) => {
          const vehicle = vehicles.find((item) => item.id === vehicleId);
          const coords = getStationCoords(vehicle?.stationId, locations);
          if (!vehicle || !coords) return null;
          const distance = haversineKm(coords, incident.coords);
          const etaSeconds = getFahrzeitSekunden(coords, incident.coords);
          return {
            vehicleId,
            distanceKm: Number(distance.toFixed(1)),
            etaSeconds,
            arrivalAt: Date.now() + etaSeconds * 1000,
          } satisfies AlarmiertesFahrzeug;
        })
        .filter((entry): entry is AlarmiertesFahrzeug => Boolean(entry));

      const nextAlarmed = [...incident.alarmedVehicles, ...vehiclesToAssign.filter(
        (entry) => !incident.alarmedVehicles.some((existing) => existing.vehicleId === entry.vehicleId),
      )];

      setVehicles((currentVehicles) => currentVehicles.map((vehicle) =>
        selectedVehicleIds.includes(vehicle.id) ? { ...vehicle, status: 'Alarmiert / auf Anfahrt' } : vehicle,
      ));

      return {
        ...incident,
        alarmedVehicles: nextAlarmed,
        status: nextAlarmed.length > 0 ? 'alarmiert' : 'offen',
      };
    }));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        {/* banner image fills the header */}
        <img className="topbar__banner" src="/brand-banner.png" alt="LeitstellenDispo Banner" />

        <div className="brand">
          <div className="brand__text">
            {/* Title and subtitle intentionally removed as requested (empty space reserved) */}
          </div>
        </div>

        <div className="topbar__meta">
          {/* Single dropdown trigger showing the currently active main view */}
          {/* Will render current view and open a small dropdown when clicked. */}
          { /* Version chip kept for visibility */ }
          <span className="chip">V{APP_VERSION}</span>

          <div className="view-dropdown">
            {/* Trigger button */}
            <button
              ref={(node) => {
                triggerRef.current = node;
              }}
              type="button"
              className="chip chip--accent view-trigger"
              onClick={() => setDropdownOpen((s) => !s)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
            {currentView} <span className="chev" aria-hidden></span>
            </button>

            {/* portal-based dropdown */}
            <ViewDropdown
              anchorRef={triggerRef}
              isOpen={dropdownOpen}
              onClose={() => setDropdownOpen(false)}
              currentView={currentView}
              onSelect={(v) => {
                selectView(v as any);
              }}
            />

          </div>
        </div>
      </header>

      <main className={`dashboard ${currentView === 'Karte' ? '' : 'dashboard--full'}`}>
        {currentView === 'Karte' && (
          <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar--collapsed'}`}>
            <div className="panel-header">
              <h2>Standorte</h2>
              <span>{locations.length}</span>
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setSidebarOpen((open) => !open)}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? 'Einklappen ▴' : 'Anzeigen ▾'}
              </button>
            </div>

            <div className="location-form">
              <label className="field">
                <span>Name</span>
                <input
                  type="text"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="z. B. Rettungswache Nord"
                />
              </label>

              <label className="field">
                <span>Typ</span>
                <select value={draftType} onChange={(event) => setDraftType(event.target.value as LocationType)}>
                  <option value="station">Standort (station)</option>
                </select>
              </label>

              <label className="field">
                <span>Wachentyp</span>
                <select value={draftStationKind} onChange={(event) => setDraftStationKind(event.target.value as any)}>
                  <option value="Rettungswache">Rettungswache</option>
                  <option value="Feuerwache">Feuerwache</option>
                </select>
              </label>

              <label className="field field--address">
                <span>Adresse</span>
                <input
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Musterstraße 12, 14467 Potsdam"
                />

                <div style={{ marginTop: 8 }}>
                  <button className="btn btn--primary" type="button" onClick={() => geocodeAddress(address)} disabled={geocodeLoading}>
                    {geocodeLoading ? 'Suche...' : 'Adresse suchen'}
                  </button>
                </div>

                {geocodeError && <div className="field-error">{geocodeError}</div>}

                {geocodeResults.length > 0 && (
                  <div className="geocode-results">
                    <small style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Gefundene Adressen — Auswahl zur Prüfung:</small>
                    <ul>
                      {geocodeResults.map((r, idx) => (
                        <li key={r.place_id}>
                          <button
                            type="button"
                            className={`view-menu-item ${selectedGeocodeIndex === idx ? 'active' : ''}`}
                            onClick={() => {
                                                                      const coords: [number, number] = [parseFloat(r.lat), parseFloat(r.lon)];
                                                                      // Übernommenes Ergebnis im Adressfeld anzeigen
                                                                      setAddress(r.display_name);
                                                                      // Preview-Marker und Auswahl setzen
                                                                      setTempCoords(coords);
                                                                      setSelectedGeocodeIndex(idx);
                                                                      // Liste der Suchergebnisse schließen
                                                                      setGeocodeResults([]);
                                                                      setGeocodeError(null);
                                                                      // Karte zur Position zentrieren
                                                                      try {
                                                                        mapRef.current?.setView(coords, mapRef.current.getZoom?.() ?? 13);
                                                                      } catch (e) { }
                                                                    }}
                                                              >
                                                                    {r.display_name}
                                                              </button>
                                                            </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
              </label>

              <p className="map-hint">Adresse eingeben → Adresse suchen → Karte zeigt Position (Vorschau). Klicke auf die Karte, um Vorschau zu verschieben.</p>

              {/* Startfahrzeug Auswahl (genau EIN Fahrzeug) */}
              <label className="field">
                <span>Startfahrzeug</span>
                <select value={draftStartVehicleType} onChange={(e) => setDraftStartVehicleType(e.target.value)}>
                  {getFahrzeugTypenFuerWache(draftStationKind).map((fahrzeugTyp) => (
                    <option key={fahrzeugTyp.typ} value={fahrzeugTyp.typ}>{fahrzeugTyp.typ}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Funkrufname (z. B. "Wache-1")</span>
                <input type="text" value={draftStartVehicleCallsign} onChange={(e) => setDraftStartVehicleCallsign(e.target.value)} placeholder="z. B. RTW-1" />
              </label>

              <p className="map-hint">Anschließend auf „Standort erstellen“ klicken — Wache und das ausgewählte Startfahrzeug werden gemeinsam erstellt.</p>

              <div style={{ marginTop: 8 }}>
                <button className="btn btn--primary" type="button" onClick={createLocationFromTemp} disabled={!tempCoords}>
                  Standort erstellen
                </button>
              </div>
            </div>

            <div className="location-list">
              {locations.map((location) => (
                <div key={location.id} className={`location-item-wrapper`}>
                  <button
                    className={`location-item${selectedId === location.id ? ' location-item--active' : ''}`}
                    onClick={() => setSelectedId(location.id)}
                    type="button"
                  >
                    <span className={`color-dot color-dot--${location.type}`} aria-hidden="true" />
                    <span className="location-copy">
                      <strong>{location.name}</strong>
                      <small>{location.description}</small>
                    </span>
                  </button>

                  {/* Lösch-Button nur für Wachen (station) anzeigen */}
                  {location.type === 'station' && (
                    <button
                    className="btn btn--danger delete-button"
                      title={`Standort ${location.name} löschen`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLocation(location.id);
                      }}
                      type="button"
                    >
                      Löschen
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="detail-card">
              <div className="detail-card__label">Ausgewählt</div>
              <h3>{selectedLocation.name}</h3>
              <p>{selectedLocation.details}</p>
              <ul>
                <li>Typ: {selectedLocation.type}</li>
                <li>
                  Koordinaten: {selectedLocation.coords[0].toFixed(4)}, {selectedLocation.coords[1].toFixed(4)}
                </li>
              </ul>
            </div>
          </aside>
        )}

        {currentView === 'Karte' ? (
          <section className="map-panel">
            <KarteEinsatzLeiste
              incidents={incidents.filter((incident) => incident.status !== 'abgeschlossen')}
              selectedId={mapIncidentId}
              onSelect={(incident) => {
                setMapIncidentId(incident.id);
                mapRef.current?.setView(incident.coords, Math.max(mapRef.current.getZoom(), 14));
              }}
            />

            {(() => {
              const mapIncident = incidents.find((incident) => incident.id === mapIncidentId && incident.status !== 'abgeschlossen');
              return mapIncident ? (
                <KarteEinsatzPanel
                  incident={mapIncident}
                  vehicles={vehicles}
                  onClose={() => setMapIncidentId(null)}
                  onOpenInEinsaetze={() => {
                    setSelectedIncidentId(mapIncident.id);
                    setMapIncidentId(null);
                    setCurrentView('Einsätze');
                  }}
                />
              ) : null;
            })()}

            <MapContainer center={[48.775, 9.185]} zoom={13} scrollWheelZoom className="map-view" ref={mapRef}>
              {mapStyle === 'karte' ? (
                <TileLayer
                  key="karte"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  subdomains="abcd"
                  maxZoom={20}
                />
              ) : (
                <TileLayer
                  key="satellit"
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
              )}

              <MapClickHandler onMapClick={handleMapClick} />
              <MapStyleToggle
                mapStyle={mapStyle}
                onToggle={() => setMapStyle((current) => (current === 'karte' ? 'satellit' : 'karte'))}
              />

              {tempCoords && (
                <Marker position={tempCoords} icon={createMarkerIcon('#2563eb')}>
                  <Popup>
                    <strong>Vorschau</strong>
                    <br />
                    Position prüfen. Drücke "Standort erstellen", um zu speichern.
                  </Popup>
                </Marker>
              )}

              {locations.map((location) => {
                const iconColor = location.type === 'incident' ? '#f59e0b' : '#d92d2d';

                return (
                  <Marker
                    key={location.id}
                    position={location.coords}
                    icon={createMarkerIcon(iconColor)}
                    eventHandlers={{ click: () => setSelectedId(location.id) }}
                  >
                    <Popup>
                      <strong>{location.name}</strong>
                      <br />
                      {location.details}
                    </Popup>
                  </Marker>
                );
              })}

              {incidents
                .filter((incident) => incident.status !== 'abgeschlossen')
                .map((incident) => (
                  <Marker
                    key={incident.id}
                    position={incident.coords}
                    icon={createIncidentMarkerIcon(incident.status, incident.id === mapIncidentId)}
                    zIndexOffset={incident.id === mapIncidentId ? 1000 : 500}
                    eventHandlers={{ click: () => setMapIncidentId(incident.id) }}
                  />
                ))}

              {/* Fahrzeuge unterwegs: gerade Linie (Luftlinie) zum Ziel */}
              {vehicles.map((vehicle) => {
                const fahrt = getFahrzeugPosition(vehicle, incidents, locations, nowMs);
                if (!fahrt) return null;
                const rueckfahrt = vehicle.status === 'Rückfahrt';
                return (
                  <Fragment key={vehicle.id}>
                    {fahrt.unterwegs && (
                      <Polyline
                        positions={[fahrt.position, fahrt.ziel]}
                        pathOptions={{ color: rueckfahrt ? '#9ca3af' : '#3b82f6', weight: 2, dashArray: '6 6', opacity: 0.8 }}
                      />
                    )}
                    <Marker
                      position={fahrt.position}
                      icon={createVehicleMarkerIcon(vehicle.callsign ?? vehicle.name, rueckfahrt)}
                      zIndexOffset={2000}
                      interactive={false}
                    />
                  </Fragment>
                );
              })}
            </MapContainer>
          </section>
        ) : (
          <section className="panel--secondary" style={{ padding: 16 }}>
            {currentView === 'Wachen' && (
              <WachenView locations={locations} selectedId={selectedId} setSelectedId={setSelectedId} vehicles={vehicles} buyVehicle={buyVehicle} />
            )}

            {currentView === 'Fahrzeuge' && (
              <FahrzeugeView vehicles={vehicles} addVehicle={addVehicle} stations={locations.filter(l => l.type === 'station')} />
            )}

            {currentView === 'Einsätze' && (
              <EinsaetzeView
                incidents={incidents}
                completedIncidentHistory={completedIncidentHistory}
                vehicles={vehicles}
                locations={locations}
                selectedIncidentId={selectedIncidentId}
                setSelectedIncidentId={setSelectedIncidentId}
                alarmIncidentVehicles={alarmIncidentVehicles}
                markiereMeldungGelesen={markiereMeldungGelesen}
                triggerTestIncident={triggerTestIncident}
                nowMs={nowMs}
                stats={completedIncidentStats}
              />
            )}

            {currentView === 'Finanzen' && (
              <FinanzenView balance={balance} locations={locations} vehicles={vehicles} transactions={transactions} />
            )}

            {currentView === 'Einstellungen' && (
              <EinstellungenView defaultView={currentView} onNeuesSpiel={neuesSpiel} />
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
