import { useMemo, useState, useRef, useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L, { type LeafletMouseEvent } from 'leaflet';
import { APP_VERSION } from '@leitstellendispo/shared';
import 'leaflet/dist/leaflet.css';
import './App.css';

import ViewDropdown from './ViewDropdown';

import type { MapLocation, LocationType } from './types';
import FahrzeugeView, { type Vehicle } from './views/FahrzeugeView';
import WachenView from './views/WachenView';
import EinsaetzeView from './views/EinsaetzeView';
import FinanzenView from './views/FinanzenView';
import EinstellungenView from './views/EinstellungenView';

const STATION_PRICE_BY_KIND = {
  Rettungswache: 0,
  Feuerwache: 0,
} as const;

const VEHICLE_PRICE_BY_TYPE: Record<string, number> = {
  RTW: 0,
  'LF 10': 0,
  'LF 20': 0,
  'TLF 2000': 0,
  'TLF 3000': 0,
  'TLF 4000': 0,
};

type IncidentStatus = 'Offen' | 'Fahrzeuge alarmiert' | 'In Bearbeitung' | 'Abgeschlossen';
type VehicleCategory = 'RTW' | 'Löschfahrzeug';

type FinanceTransaction = {
  id: string;
  kind: 'Einnahme' | 'Ausgabe';
  label: string;
  amount: number;
  createdAt: string;
};

type IncidentRequirement = {
  id: string;
  category: VehicleCategory;
  amount: number;
};

type AlarmedVehicle = {
  vehicleId: string;
  distanceKm: number;
  etaSeconds: number;
  arrivalAt: number;
};

type IncidentTemplate = {
  id: string;
  type: string;
  organization: 'Rettungsdienst' | 'Feuerwehr';
  requiredVehicles: IncidentRequirement[];
  reward: number;
  durationSeconds: number;
};

type Incident = {
  id: string;
  type: string;
  organization: 'Rettungsdienst' | 'Feuerwehr';
  status: IncidentStatus;
  coords: [number, number];
  address: string;
  generatedByStationId: string;
  generatedByStationName: string;
  requiredVehicles: IncidentRequirement[];
  alarmedVehicles: AlarmedVehicle[];
  reward: number;
  durationSeconds: number;
  createdAt: number;
  processingStartedAt?: number;
  processingEndsAt?: number;
  completedAt?: number;
  totalDurationSeconds?: number;
};

type CompletedIncident = Incident & {
  completedAt: number;
  totalDurationSeconds: number;
};

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

const createMarkerIcon = (color: string) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<span style="display:block; width:16px; height:16px; border-radius:50%; background:${color}; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.25);"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

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

const getVehicleCategory = (type?: string): VehicleCategory | null => {
  if (!type) return null;
  if (type === 'RTW') return 'RTW';
  if (['LF 10', 'LF 20', 'TLF 2000', 'TLF 3000', 'TLF 4000'].includes(type)) return 'Löschfahrzeug';
  return null;
};

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

const getStationCoords = (stationId: string | undefined, locations: MapLocation[]) => {
  if (!stationId) return null;
  const found = locations.find((location) => location.id === stationId && location.type === 'station');
  return found ? found.coords : null;
};

const INCIDENT_TEMPLATE_SETS: Record<'Rettungswache' | 'Feuerwache', IncidentTemplate[]> = {
  Rettungswache: [
    {
      id: 'kreislaufprobleme',
      type: 'Kreislaufprobleme',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 240,
      durationSeconds: 11,
    },
    {
      id: 'gestuerzte-person',
      type: 'Gestürzte Person',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 220,
      durationSeconds: 10,
    },
    {
      id: 'atemnot',
      type: 'Atemnot',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 260,
      durationSeconds: 12,
    },
    {
      id: 'brustschmerzen',
      type: 'Brustschmerzen',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 280,
      durationSeconds: 13,
    },
    {
      id: 'schnittverletzung',
      type: 'Schnittverletzung',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 230,
      durationSeconds: 9,
    },
    {
      id: 'sturz',
      type: 'Sturz',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 220,
      durationSeconds: 10,
    },
    {
      id: 'bewusstlose-person',
      type: 'Bewusstlose Person',
      organization: 'Rettungsdienst',
      requiredVehicles: [{ id: 'req-rtw', category: 'RTW', amount: 1 }],
      reward: 260,
      durationSeconds: 12,
    },
  ],
  Feuerwache: [
    {
      id: 'brennender-papierkorb',
      type: 'Brennender Papierkorb',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 220,
      durationSeconds: 10,
    },
    {
      id: 'brennende-muelltonne',
      type: 'Brennende Mülltonne',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 240,
      durationSeconds: 11,
    },
    {
      id: 'heckenbrand',
      type: 'Heckenbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 260,
      durationSeconds: 12,
    },
    {
      id: 'brennender-pkw',
      type: 'Brennender PKW',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 310,
      durationSeconds: 15,
    },
    {
      id: 'unklare-rauchentwicklung',
      type: 'Unklare Rauchentwicklung',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 290,
      durationSeconds: 14,
    },
    {
      id: 'muelleimerbrand',
      type: 'Mülleimerbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 250,
      durationSeconds: 12,
    },
    {
      id: 'kleinbrand',
      type: 'Kleinbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [{ id: 'req-lz', category: 'Löschfahrzeug', amount: 1 }],
      reward: 300,
      durationSeconds: 14,
    },
  ],
};

const getAvailableIncidentTemplates = (stationKind?: 'Rettungswache' | 'Feuerwache'): IncidentTemplate[] => { 
  return INCIDENT_TEMPLATE_SETS[stationKind ?? 'Rettungswache'] ?? INCIDENT_TEMPLATE_SETS.Rettungswache;
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
  template: IncidentTemplate,
  vehicles: Vehicle[],
) => {
  const matchingStations = stations
    .map((station) => {
      const matchingVehicles = vehicles.filter(
        (vehicle) =>
          vehicle.stationId === station.id &&
          vehicle.status === 'Einsatzbereit' &&
          getVehicleCategory(vehicle.type) === template.requiredVehicles[0]?.category,
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

function App() {
  const [locations, setLocations] = useState<MapLocation[]>(initialLocations);
  const [selectedId, setSelectedId] = useState<string>(initialLocations[0].id);
  const [draftName, setDraftName] = useState('Neue Rettungswache');
  const [draftType, setDraftType] = useState<LocationType>('station');

  // Vehicles state (prepared)
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { id: 'fahrzeug-1', name: 'RTW 1', type: 'RTW', stationId: 'rettungswache-zentrum', price: 0, callsign: 'RTW-1', status: 'Einsatzbereit' },
    { id: 'fahrzeug-2', name: 'LF 1', type: 'LF 10', stationId: undefined, price: 0, callsign: 'LF-1', status: 'Einsatzbereit' },
  ]);

  // Finances
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([
    { id: 'initial-balance', kind: 'Einnahme', label: 'Startguthaben', amount: 0, createdAt: new Date().toISOString() },
  ]);

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

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [completedIncidentHistory, setCompletedIncidentHistory] = useState<CompletedIncident[]>([]);
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
    const stationPool = locations.filter((location) => location.type === 'station');
    if (stationPool.length === 0) return;
    if (incidents.filter((incident) => incident.status !== 'Abgeschlossen').length >= GAME_CONFIG.maxOpenIncidents) return;

    const interval = setInterval(() => {
      setIncidents((current) => {
        if (current.filter((incident) => incident.status !== 'Abgeschlossen').length >= GAME_CONFIG.maxOpenIncidents) {
          return current;
        }

        const activeStations = locations.filter((location) => location.type === 'station');
        if (activeStations.length === 0) return current;

        const stationKind = activeStations[Math.floor(Math.random() * activeStations.length)].stationKind;
        const templates = getAvailableIncidentTemplates(stationKind);
        const template = templates[Math.floor(Math.random() * templates.length)];
        const station = getBestIncidentStation(activeStations, template, vehicles);
        const coords = getRandomCoordsAroundStation(station, activeStations.length);

        const nextIncident: Incident = {
          id: `incident-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          type: template.type,
          organization: template.organization,
          status: 'Offen',
          coords,
          address: `${template.type} in der Nähe von ${station.name}`,
          generatedByStationId: station.id,
          generatedByStationName: station.name,
          requiredVehicles: template.requiredVehicles,
          alarmedVehicles: [],
          reward: template.reward,
          durationSeconds: template.durationSeconds,
          createdAt: Date.now(),
        };

        return [nextIncident, ...current];
      });
    }, GAME_CONFIG.incidentGenerationMs);

    return () => clearInterval(interval);
  }, [locations, incidents, vehicles]);

  useEffect(() => {
    if (draftStationKind === 'Rettungswache') setDraftStartVehicleType('RTW');
    else setDraftStartVehicleType('LF 10');
  }, [draftStationKind]);

  useEffect(() => {
    let changed = false;
    const nextVehicles: Vehicle[] = vehicles.map((vehicle): Vehicle => {
      const activeIncident = incidents.find(
        (incident) => incident.status !== 'Abgeschlossen' && incident.alarmedVehicles.some((entry) => entry.vehicleId === vehicle.id),
      );

      if (!activeIncident) {
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

    const completed: Incident[] = [];
    const nextIncidents: Incident[] = incidents.map((incident): Incident => {
      if (incident.status === 'Abgeschlossen') return incident;

      const activeVehicles = incident.alarmedVehicles
        .map((assignment) => nextVehicles.find((vehicle) => vehicle.id === assignment.vehicleId))
        .filter((vehicle): vehicle is Vehicle => Boolean(vehicle));

      const requirementSatisfied = incident.requiredVehicles.every((requirement) => {
        const matches = activeVehicles.filter((vehicle) => getVehicleCategory(vehicle.type) === requirement.category).length;
        return matches >= requirement.amount;
      });

      const allArrived = incident.alarmedVehicles.every((assignment) => nowMs >= assignment.arrivalAt);
      let updated = { ...incident };

      if (incident.alarmedVehicles.length > 0 && incident.status === 'Offen') {
        updated.status = 'Fahrzeuge alarmiert';
        changed = true;
      }

      if (updated.status === 'Fahrzeuge alarmiert' && requirementSatisfied && allArrived && !updated.processingStartedAt) {
        updated.status = 'In Bearbeitung';
        updated.processingStartedAt = nowMs;
        updated.processingEndsAt = nowMs + updated.durationSeconds * 1000;
        changed = true;
      }

      if (updated.status === 'In Bearbeitung') {
        if (!updated.processingEndsAt) {
          updated.processingEndsAt = nowMs + updated.durationSeconds * 1000;
        }
        if (nowMs >= updated.processingEndsAt) {
          updated.status = 'Abgeschlossen';
          completed.push(updated);
          changed = true;
        }
      }

      return updated;
    });

    if (completed.length > 0) {
      const completedHistoryEntries = completed.map((incident) => ({
        ...incident,
        completedAt: nowMs,
        totalDurationSeconds: Math.max(
          1,
          Math.round(((incident.processingEndsAt ?? nowMs) - (incident.processingStartedAt ?? incident.createdAt)) / 1000),
        ),
      })) satisfies CompletedIncident[];

      setCompletedIncidentHistory((current) => [
        ...completedHistoryEntries,
        ...current,
      ].slice(0, GAME_CONFIG.completedIncidentHistoryLimit));

      setBalance((cur) => cur + completed.reduce((sum, incident) => sum + incident.reward, 0));
      completed.forEach((incident) => addTransaction('Einnahme', `${incident.organization} – ${incident.type} abgeschlossen`, incident.reward));
      setVehicles((current) => current.map((vehicle) => {
        const isCompleted = completed.some((incident) =>
          incident.alarmedVehicles.some((assignment) => assignment.vehicleId === vehicle.id),
        );
        return isCompleted ? { ...vehicle, status: 'Einsatzbereit' } : vehicle;
      }));
      setIncidents((current) => current.filter((incident) => !completed.some((item) => item.id === incident.id)));
      setSelectedIncidentId((current) => (current && completed.some((incident) => incident.id === current) ? null : current));
    }

    if (changed) {
      setVehicles(nextVehicles);
      setIncidents(nextIncidents.filter((incident) => incident.status !== 'Abgeschlossen'));
    }
  }, [incidents, vehicles, nowMs]);

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

    const stationPrice = STATION_PRICE_BY_KIND[draftStationKind] ?? 0;
    const vehiclePrice = VEHICLE_PRICE_BY_TYPE[draftStartVehicleType] ?? 0;
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
      description: 'Rettungsdienst',
      details: address.trim() || 'Frei platzierbarer Rettungsstandort',
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
    const templates = getAvailableIncidentTemplates(stationKind);
    const template = templates[Math.floor(Math.random() * templates.length)];
    const station = getBestIncidentStation(stationPool, template, vehicles);
    const coords = getRandomCoordsAroundStation(station, stationPool.length);

    const newIncident: Incident = {
      id: `incident-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: template.type,
      organization: template.organization,
      status: 'Offen',
      coords,
      address: `${template.type} in ${station.name}`,
      generatedByStationId: station.id,
      generatedByStationName: station.name,
      requiredVehicles: template.requiredVehicles,
      alarmedVehicles: [],
      reward: template.reward,
      durationSeconds: template.durationSeconds,
      createdAt: Date.now(),
    };

    setIncidents((current) => [newIncident, ...current]);
    setSelectedIncidentId(newIncident.id);
    setCurrentView('Einsätze');
  };

  const alarmIncidentVehicles = (incidentId: string, selectedVehicleIds: string[]) => {
    if (selectedVehicleIds.length === 0) return;

    setIncidents((current) => current.map((incident) => {
      if (incident.id !== incidentId) return incident;

      const vehiclesToAssign = selectedVehicleIds
        .map((vehicleId) => {
          const vehicle = vehicles.find((item) => item.id === vehicleId);
          const coords = getStationCoords(vehicle?.stationId, locations);
          if (!vehicle || !coords) return null;
          const distance = haversineKm(coords, incident.coords);
          const etaSeconds = Math.max(1, Math.round((distance / GAME_CONFIG.averageSpeedKmh) * 3600));
          return {
            vehicleId,
            distanceKm: Number(distance.toFixed(1)),
            etaSeconds,
            arrivalAt: Date.now() + etaSeconds * 1000,
          } satisfies AlarmedVehicle;
        })
        .filter((entry): entry is AlarmedVehicle => Boolean(entry));

      const nextAlarmed = [...incident.alarmedVehicles, ...vehiclesToAssign.filter(
        (entry) => !incident.alarmedVehicles.some((existing) => existing.vehicleId === entry.vehicleId),
      )];

      setVehicles((currentVehicles) => currentVehicles.map((vehicle) =>
        selectedVehicleIds.includes(vehicle.id) ? { ...vehicle, status: 'Alarmiert / auf Anfahrt' } : vehicle,
      ));

      return {
        ...incident,
        alarmedVehicles: nextAlarmed,
        status: nextAlarmed.length > 0 ? 'Fahrzeuge alarmiert' : 'Offen',
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

      <main className="dashboard">
        <aside className="sidebar">
          <div className="panel-header">
            <h2>Standorte</h2>
            <span>{locations.length}</span>
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
                {draftStationKind === 'Rettungswache' ? (
                  <option value="RTW">RTW</option>
                ) : (
                  <>
                    <option value="LF 10">LF 10</option>
                    <option value="LF 20">LF 20</option>
                    <option value="TLF 2000">TLF 2000</option>
                    <option value="TLF 3000">TLF 3000</option>
                    <option value="TLF 4000">TLF 4000</option>
                  </>
                )}
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

        {currentView === 'Karte' ? (
          <section className="map-panel">
            <MapContainer center={[48.775, 9.185]} zoom={13} scrollWheelZoom className="map-view" ref={mapRef}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapClickHandler onMapClick={handleMapClick} />

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
                .filter((incident) => incident.status !== 'Abgeschlossen')
                .map((incident) => (
                  <Marker
                    key={incident.id}
                    position={incident.coords}
                    icon={createMarkerIcon('#f59e0b')}
                    eventHandlers={{ click: () => setSelectedIncidentId(incident.id) }}
                  >
                    <Popup>
                      <strong>{incident.type}</strong>
                      <br />
                      {incident.organization}
                      <br />
                      Status: {incident.status}
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </section>
        ) : (
          <section className="panel--secondary" style={{ padding: 16 }}>
            {currentView === 'Wachen' && (
              <WachenView locations={locations} selectedId={selectedId} setSelectedId={setSelectedId} vehicles={vehicles} />
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
                triggerTestIncident={triggerTestIncident}
                nowMs={nowMs}
                stats={completedIncidentStats}
              />
            )}

            {currentView === 'Finanzen' && (
              <FinanzenView balance={balance} locations={locations} vehicles={vehicles} transactions={transactions} />
            )}

            {currentView === 'Einstellungen' && (
              <EinstellungenView defaultView={currentView} />
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
