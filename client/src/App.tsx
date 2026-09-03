import { useMemo, useState, useRef, useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L, { type LeafletMouseEvent } from 'leaflet';
import { getDefaultVehicleCapacity, STATION_PRICE_BY_KIND } from '@leitstellendispo/shared';
import { isFmsAlarmable, type FmsStatus, type OperationalFmsStatus } from '@leitstellendispo/shared';
import 'leaflet/dist/leaflet.css';
import './App.css';

import ViewDropdown from './ViewDropdown';

import type { MapLocation } from './types';
import FahrzeugeView, { type Vehicle } from './views/FahrzeugeView';
import WachenView from './views/WachenView';
import EinsaetzeView from './views/EinsaetzeView';
import FinanzenView from './views/FinanzenView';
import EinstellungenView from './views/EinstellungenView';
import LeitstelleView from './views/LeitstelleView';
import { VEHICLE_CATALOG, getVehicleCatalogEntry, vehicleMeetsRequirement } from './vehicleCatalog';
import { getUpgradeDefinition, getUpgradePrice } from './upgradeCatalog';
import { canStartTraining, getFreeTrainingRoomIndex, resolveTrainingCourseLifecycle, type TrainingCourse } from './stationState';
import { MAX_TRAINING_PARTICIPANTS, TRAINING_CATALOG } from './trainingCatalog';

type IncidentStatus = 'Offen' | 'Fahrzeuge alarmiert' | 'In Bearbeitung' | 'Abgeschlossen';
type MapLayerMode = 'Karte' | 'Satellit';
type FinanceTransaction = {
  id: string;
  kind: 'Einnahme' | 'Ausgabe';
  label: string;
  amount: number;
  createdAt: string;
};

type IncidentRequirement = {
  id: string;
  type: 'capability' | 'vehicleType';
  value: string;
  amount: number;
  label: string;
};

const capabilityRequirement = (id: string, value: string, amount: number, label: string): IncidentRequirement => ({ id, type: 'capability', value, amount, label });
const vehicleTypeRequirement = (id: string, value: string, amount: number, label: string): IncidentRequirement => ({ id, type: 'vehicleType', value, amount, label });

const normalizeIncident = (incident: Incident): Incident => ({
  ...incident,
  requiredVehicles: incident.requiredVehicles.map((requirement) => {
    const legacy = requirement as IncidentRequirement & { category?: string };
    if (legacy.type) return legacy;
    return legacy.category === 'RTW'
      ? vehicleTypeRequirement(legacy.id, 'RTW', legacy.amount, 'RTW')
      : capabilityRequirement(legacy.id, 'firefighting', legacy.amount, legacy.amount === 1 ? 'Löschfahrzeug' : 'Löschfahrzeuge');
  }),
});

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

type Staff = {
  id: string;
  name: string;
  stationId: string;
  qualifications: string[];
  inTraining?: boolean;
};

const getVehicleCrewRequirement = (vehicle: Vehicle) => {
  const catalogEntry = getVehicleCatalogEntry(vehicle.type);
  return catalogEntry?.technical.crewRequired ?? vehicle.crewRequired ?? 0;
};

const getVehicleRequiredQualifications = (vehicle: Vehicle) => {
  const catalogEntry = getVehicleCatalogEntry(vehicle.type);
  return catalogEntry?.technical.requiredQualifications ?? [];
};

const getAvailableStaffForVehicle = (vehicle: Vehicle, vehicles: Vehicle[], staff: Staff[]) => {
  const requiredCount = getVehicleCrewRequirement(vehicle);
  const requiredQualifications = getVehicleRequiredQualifications(vehicle);
  const assignedStaffIds = new Set(
    vehicles
      .filter((candidate) => candidate.id !== vehicle.id)
      .flatMap((candidate) => candidate.assignedStaffIds ?? [])
      .filter((id): id is string => Boolean(id)),
  );

  const candidates = staff.filter((member) => {
    if (!member.stationId || member.stationId !== vehicle.stationId) return false;
    if (member.inTraining) return false;
    if (assignedStaffIds.has(member.id)) return false;
    return true;
  });

  const selectedIds: string[] = [];
  const seen = new Set<string>();

  for (const qualification of requiredQualifications) {
    const matching = candidates.filter((member) => member.qualifications.includes(qualification) && !seen.has(member.id));
    for (const member of matching) {
      if (selectedIds.length >= requiredCount) break;
      selectedIds.push(member.id);
      seen.add(member.id);
    }
    if (selectedIds.length >= requiredCount) break;
  }

  for (const candidate of candidates) {
    if (selectedIds.length >= requiredCount) break;
    if (seen.has(candidate.id)) continue;
    selectedIds.push(candidate.id);
    seen.add(candidate.id);
  }

  return selectedIds.slice(0, requiredCount);
};

const getFmsStatus = (vehicle: Vehicle): FmsStatus => {
  if (vehicle.fmsStatus) return vehicle.fmsStatus;
  if (vehicle.status === 'Alarmiert / auf Anfahrt') return 3;
  if (vehicle.status === 'Im Einsatz') return 4;
  return 2;
};

const toOperationalStatus = (vehicle: Vehicle): OperationalFmsStatus => {
  const status = getFmsStatus(vehicle);
  return status === 5 ? (vehicle.previousOperationalStatus ?? 2) : status;
};

const withFmsStatus = (vehicle: Vehicle, fmsStatus: FmsStatus, returnAt?: number): Vehicle => ({
  ...vehicle,
  fmsStatus,
  returnAt,
  status: fmsStatus === 3 ? 'Alarmiert / auf Anfahrt' : fmsStatus === 4 ? 'Im Einsatz' : fmsStatus === 6 ? 'Nicht einsatzbereit' : 'Einsatzbereit',
  ...(fmsStatus === 5 ? { previousOperationalStatus: toOperationalStatus(vehicle), speechRequest: true } : { speechRequest: false }),
  ...(fmsStatus === 2 ? { assignedStaffIds: [] } : {}),
});

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

const createFireStationIcon = (zoom: number) => {
  const scale = clamp(2 ** ((zoom - 13) / 3), 0.45, 1.35);
  const width = Math.round(68 * scale);
  const height = Math.round(45 * scale);

  return L.divIcon({
    className: 'fire-station-marker',
    html: '<img src="/fire-station.png" alt="Feuerwache" />',
    iconSize: [width, height],
    iconAnchor: [Math.round(width / 2), Math.round(height * 0.93)],
    popupAnchor: [0, -Math.round(height * 0.85)],
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
      requiredVehicles: [vehicleTypeRequirement('req-rtw', 'RTW', 1, 'RTW')],
      reward: 240,
      durationSeconds: 11,
    },
    {
      id: 'gestuerzte-person',
      type: 'Gestürzte Person',
      organization: 'Rettungsdienst',
      requiredVehicles: [vehicleTypeRequirement('req-rtw', 'RTW', 1, 'RTW')],
      reward: 220,
      durationSeconds: 10,
    },
    {
      id: 'atemnot',
      type: 'Atemnot',
      organization: 'Rettungsdienst',
      requiredVehicles: [vehicleTypeRequirement('req-rtw', 'RTW', 1, 'RTW')],
      reward: 260,
      durationSeconds: 12,
    },
    {
      id: 'brustschmerzen',
      type: 'Brustschmerzen',
      organization: 'Rettungsdienst',
      requiredVehicles: [vehicleTypeRequirement('req-rtw', 'RTW', 1, 'RTW')],
      reward: 280,
      durationSeconds: 13,
    },
    {
      id: 'schnittverletzung',
      type: 'Schnittverletzung',
      organization: 'Rettungsdienst',
      requiredVehicles: [vehicleTypeRequirement('req-rtw', 'RTW', 1, 'RTW')],
      reward: 230,
      durationSeconds: 9,
    },
    {
      id: 'sturz',
      type: 'Sturz',
      organization: 'Rettungsdienst',
      requiredVehicles: [vehicleTypeRequirement('req-rtw', 'RTW', 1, 'RTW')],
      reward: 220,
      durationSeconds: 10,
    },
    {
      id: 'bewusstlose-person',
      type: 'Bewusstlose Person',
      organization: 'Rettungsdienst',
      requiredVehicles: [vehicleTypeRequirement('req-rtw', 'RTW', 1, 'RTW')],
      reward: 260,
      durationSeconds: 12,
    },
  ],
  Feuerwache: [
    {
      id: 'brennender-papierkorb',
      type: 'Brennender Papierkorb',
      organization: 'Feuerwehr',
      requiredVehicles: [capabilityRequirement('req-firefighting', 'firefighting', 1, 'Löschfahrzeug')],
      reward: 220,
      durationSeconds: 10,
    },
    {
      id: 'brennende-muelltonne',
      type: 'Brennende Mülltonne',
      organization: 'Feuerwehr',
      requiredVehicles: [capabilityRequirement('req-firefighting', 'firefighting', 1, 'Löschfahrzeug')],
      reward: 240,
      durationSeconds: 11,
    },
    {
      id: 'heckenbrand',
      type: 'Heckenbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [capabilityRequirement('req-firefighting', 'firefighting', 1, 'Löschfahrzeug')],
      reward: 260,
      durationSeconds: 12,
    },
    {
      id: 'brennender-pkw',
      type: 'Brennender PKW',
      organization: 'Feuerwehr',
      requiredVehicles: [capabilityRequirement('req-firefighting', 'firefighting', 2, 'Löschfahrzeuge')],
      reward: 310,
      durationSeconds: 15,
    },
    {
      id: 'unklare-rauchentwicklung',
      type: 'Unklare Rauchentwicklung',
      organization: 'Feuerwehr',
      requiredVehicles: [capabilityRequirement('req-firefighting', 'firefighting', 1, 'Löschfahrzeug')],
      reward: 290,
      durationSeconds: 14,
    },
    {
      id: 'muelleimerbrand',
      type: 'Mülleimerbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [capabilityRequirement('req-firefighting', 'firefighting', 1, 'Löschfahrzeug')],
      reward: 250,
      durationSeconds: 12,
    },
    {
      id: 'kleinbrand',
      type: 'Kleinbrand',
      organization: 'Feuerwehr',
      requiredVehicles: [capabilityRequirement('req-firefighting', 'firefighting', 1, 'Löschfahrzeug')],
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
          isFmsAlarmable(getFmsStatus(vehicle), vehicle.previousOperationalStatus) &&
          vehicleMeetsRequirement(vehicle.type, template.requiredVehicles[0]),
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

function MapZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    zoomend: (event) => onZoomChange(event.target.getZoom()),
  });

  return null;
}

function App() {
  const [locations, setLocations] = useState<MapLocation[]>(initialLocations);
  const [selectedId, setSelectedId] = useState<string>(initialLocations[0].id);
  const [draftName, setDraftName] = useState('Neue Rettungswache');
  const [mapZoom, setMapZoom] = useState(13);

  // Vehicles state (prepared)
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { id: 'fahrzeug-1', name: 'RTW 1', type: 'RTW', stationId: 'rettungswache-zentrum', price: 0, callsign: 'RTW-1', status: 'Einsatzbereit', crewRequired: 2, assignedStaffIds: [] },
    { id: 'fahrzeug-2', name: 'LF 1', type: 'LF 10', stationId: undefined, price: 0, callsign: 'LF-1', status: 'Einsatzbereit', crewRequired: 3, assignedStaffIds: [] },
  ]);
  const [staff, setStaff] = useState<Staff[]>([
    { id: 'staff-r1', name: 'Anna Schmitz', stationId: 'rettungswache-zentrum', qualifications: ['driver', 'medical'], inTraining: false },
    { id: 'staff-r2', name: 'Ben Weber', stationId: 'rettungswache-zentrum', qualifications: ['medical', 'first-responder'], inTraining: false },
    { id: 'staff-r3', name: 'Carla Klein', stationId: 'rettungswache-zentrum', qualifications: ['driver'], inTraining: false },
    { id: 'staff-r4', name: 'Dieter Lenz', stationId: 'rettungswache-zentrum', qualifications: ['medical'], inTraining: true },
    { id: 'staff-r5', name: 'Eva Hoffmann', stationId: 'rettungswache-zentrum', qualifications: ['driver', 'first-responder'], inTraining: false },
  ]);
  const [trainingCourses, setTrainingCourses] = useState<TrainingCourse[]>([]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTrainingCourses((currentCourses) => {
        const nextResult = resolveTrainingCourseLifecycle(currentCourses, staff);
        if (!nextResult.changed) return currentCourses;
        setStaff(nextResult.staff);
        return nextResult.trainingCourses;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [staff]);

  // Finances
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([
    { id: 'initial-balance', kind: 'Einnahme', label: 'Startguthaben', amount: 0, createdAt: new Date().toISOString() },
  ]);
  const [gameStateLoaded, setGameStateLoaded] = useState(false);

  const persistAssets = (nextLocations: MapLocation[], nextVehicles: Vehicle[]) => {
    fetch('/api/game-state/assets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: nextLocations, vehicles: nextVehicles }),
    }).catch((error) => console.error('Spielstand konnte nicht gespeichert werden.', error));
  };

  const persistSimulation = (nextIncidents: Incident[], nextVehicles: Vehicle[]) => {
    fetch('/api/game-state/simulation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidents: nextIncidents, vehicles: nextVehicles }),
    }).catch((error) => console.error('Einsatzstatus konnte nicht gespeichert werden.', error));
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/game-state')
      .then((response) => {
        if (!response.ok) throw new Error('Spielstand konnte nicht geladen werden.');
        return response.json();
      })
      .then((state: { balance: number; transactions: FinanceTransaction[]; completedIncidents: CompletedIncident[]; locations: MapLocation[]; vehicles: Vehicle[]; incidents?: Incident[]; trainingCourses?: TrainingCourse[] }) => {
        if (cancelled) return;
        setBalance(state.balance);
        setTransactions(state.transactions);
        setCompletedIncidentHistory(state.completedIncidents);
        setTrainingCourses(Array.isArray(state.trainingCourses) ? state.trainingCourses : []);
        if (state.locations.length > 0) {
          setLocations(state.locations.map((location) => location.type === 'station'
            ? {
                ...location,
                stationKind: location.stationKind ?? (location.description === 'Feuerwehr' ? 'Feuerwache' : 'Rettungswache'),
                vehicleCapacity: location.vehicleCapacity ?? getDefaultVehicleCapacity(location.stationKind ?? (location.description === 'Feuerwehr' ? 'Feuerwache' : 'Rettungswache')),
                upgradeLevels: location.upgradeLevels ?? {},
                staffSatisfaction: location.staffSatisfaction ?? 100,
              }
            : location));
          setSelectedId(state.locations[0].id);
        }
        if (state.vehicles.length > 0) {
          setVehicles(state.vehicles.map((vehicle) => withFmsStatus(vehicle, getFmsStatus(vehicle), vehicle.returnAt)));
        }
        if (state.incidents) setIncidents(state.incidents.map(normalizeIncident));
        setGameStateLoaded(true);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setGameStateLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    const nextVehicle = { ...v, id, status: v.status ?? 'Einsatzbereit', fmsStatus: v.fmsStatus ?? 2 as const };
    const nextVehicles = [...vehicles, nextVehicle];
    setVehicles(nextVehicles);
    persistAssets(locations, nextVehicles);
  };

  const purchaseVehicle = (stationId: string, type: string, callsign: string) => {
    const station = locations.find((location) => location.id === stationId && location.type === 'station');
    const stationKind = station?.stationKind ?? 'Rettungswache';
    const catalogEntry = Object.values(VEHICLE_CATALOG).flat().find((entry) => entry.type === type && entry.unlock.stationKinds.includes(stationKind));
    if (!catalogEntry) return false;
    const price = catalogEntry.price;
    if (balance < price) return false;
    const stationVehicleCount = vehicles.filter((vehicle) => vehicle.stationId === stationId).length;
    const vehicleCapacity = station?.vehicleCapacity ?? getDefaultVehicleCapacity(station?.stationKind);
    if (stationVehicleCount >= vehicleCapacity) return false;
    const nextVehicle: Vehicle = {
      id: `fahrzeug-${Date.now()}`,
      name: type,
      type,
      stationId,
      price,
      callsign,
      status: 'Einsatzbereit',
      fmsStatus: catalogEntry.initialFmsStatus,
    };
    const nextVehicles = [...vehicles, nextVehicle];
    const nextBalance = balance - price;
    const nextTransactions = [{ id: `txn-${Date.now()}-${Math.random().toString(16).slice(2)}`, kind: 'Ausgabe' as const, label: `${type} für Wache gekauft`, amount: price, createdAt: new Date().toISOString() }, ...transactions];
    setVehicles(nextVehicles);
    setBalance(nextBalance);
    setTransactions(nextTransactions);
    persistAssets(locations, nextVehicles);
    fetch('/api/game-state/finance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: nextBalance, transactions: nextTransactions }) }).catch((error) => console.error('Fahrzeugkauf konnte nicht gespeichert werden.', error));
    return true;
  };

  const purchaseUpgrade = (stationId: string, upgradeId: string) => {
    const station = locations.find((location) => location.id === stationId && location.type === 'station');
    const upgrade = getUpgradeDefinition(upgradeId);
    const currentLevel = station?.upgradeLevels?.[upgradeId] ?? 0;
    const price = upgrade ? getUpgradePrice(upgrade, currentLevel + 1) : undefined;
    if (!station || !upgrade || price === undefined || balance < price) return false;
    const nextLocation = {
      ...station,
      upgradeLevels: { ...(station.upgradeLevels ?? {}), [upgradeId]: currentLevel + 1 },
      vehicleCapacity: upgrade.effect.vehicleCapacityIncrease
        ? (station.vehicleCapacity ?? getDefaultVehicleCapacity(station.stationKind)) + upgrade.effect.vehicleCapacityIncrease
        : station.vehicleCapacity,
    };
    const nextLocations = locations.map((location) => location.id === stationId ? nextLocation : location);
    const nextBalance = balance - price;
    const nextTransactions = [{ id: `txn-${Date.now()}-${Math.random().toString(16).slice(2)}`, kind: 'Ausgabe' as const, label: `${upgrade.name} für ${station.name}`, amount: price, createdAt: new Date().toISOString() }, ...transactions];
    setLocations(nextLocations);
    setBalance(nextBalance);
    setTransactions(nextTransactions);
    persistAssets(nextLocations, vehicles);
    fetch('/api/game-state/finance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: nextBalance, transactions: nextTransactions }) }).catch((error) => console.error('Wachenausbau konnte nicht gespeichert werden.', error));
    return true;
  };

  const updateBalance = (nextBalance: number, label: string, kind: FinanceTransaction['kind'] = 'Einnahme') => {
    if (!Number.isFinite(nextBalance) || nextBalance < 0) return false;
    const nextTransactions = [{ id: `txn-${Date.now()}-${Math.random().toString(16).slice(2)}`, kind, label, amount: Math.abs(nextBalance - balance), createdAt: new Date().toISOString() }, ...transactions];
    setBalance(nextBalance);
    setTransactions(nextTransactions);
    fetch('/api/game-state/finance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: nextBalance, transactions: nextTransactions }) }).catch((error) => console.error('Geldänderung konnte nicht gespeichert werden.', error));
    return true;
  };

  const updateStationUpgradeLevel = (stationId: string, upgradeId: string, nextLevel: number) => {
    const station = locations.find((location) => location.id === stationId && location.type === 'station');
    if (!station) return false;
    const nextLocations = locations.map((location) => location.id === stationId
      ? { ...location, upgradeLevels: { ...(location.upgradeLevels ?? {}), [upgradeId]: nextLevel } }
      : location);
    setLocations(nextLocations);
    persistAssets(nextLocations, vehicles);
    return true;
  };

  const startTraining = (stationId: string, trainingId: string, participantIds: string[]) => {
    const station = locations.find((location) => location.id === stationId && location.type === 'station');
    const selectedTraining = TRAINING_CATALOG.find((training) => training.id === trainingId);
    if (!station || !selectedTraining) return false;
    if (!canStartTraining(station, trainingCourses, participantIds.length)) return false;
    if (!selectedTraining.stationKinds.includes(station.stationKind ?? 'Rettungswache')) return false;
    if (participantIds.length > MAX_TRAINING_PARTICIPANTS) return false;
    if (participantIds.length === 0) return false;

    const nextRoomIndex = getFreeTrainingRoomIndex(station, trainingCourses);
    if (nextRoomIndex === null) return false;

    const startsAt = Date.now();
    const nextCourse: TrainingCourse = {
      id: `training-${Date.now()}`,
      stationId,
      roomIndex: nextRoomIndex,
      trainingId: selectedTraining.id,
      participantIds,
      startedAt: new Date(startsAt).toISOString(),
      durationSeconds: selectedTraining.durationSeconds,
      endsAt: new Date(startsAt + selectedTraining.durationSeconds * 1000).toISOString(),
    };

    const nextCourses = [...trainingCourses, nextCourse];
    setTrainingCourses(nextCourses);
    setStaff((current) => current.map((member) => (
      participantIds.includes(member.id)
        ? { ...member, inTraining: true }
        : member
    )));
    fetch('/api/game-state/assets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations, vehicles, trainingCourses: nextCourses }),
    }).catch((error) => console.error('Lehrgang konnte nicht gespeichert werden.', error));
    return true;
  };

  const resetGameState = async () => {
    const response = await fetch('/api/game-state/reset', { method: 'POST' });
    if (!response.ok) return false;
    const nextState: { balance: number; transactions: FinanceTransaction[]; completedIncidents: CompletedIncident[]; locations: MapLocation[]; vehicles: Vehicle[]; incidents?: Incident[]; trainingCourses?: TrainingCourse[] } = await response.json();
    setBalance(nextState.balance);
    setTransactions(nextState.transactions);
    setCompletedIncidentHistory(nextState.completedIncidents ?? []);
    setTrainingCourses(Array.isArray(nextState.trainingCourses) ? nextState.trainingCourses : []);
    setLocations(nextState.locations.length > 0 ? nextState.locations.map((location) => location.type === 'station'
      ? {
          ...location,
          stationKind: location.stationKind ?? (location.description === 'Feuerwehr' ? 'Feuerwache' : 'Rettungswache'),
          vehicleCapacity: location.vehicleCapacity ?? getDefaultVehicleCapacity(location.stationKind ?? (location.description === 'Feuerwehr' ? 'Feuerwache' : 'Rettungswache')),
          upgradeLevels: location.upgradeLevels ?? {},
          staffSatisfaction: location.staffSatisfaction ?? 100,
        }
      : location) : initialLocations);
    setVehicles(nextState.vehicles.length > 0 ? nextState.vehicles.map((vehicle) => withFmsStatus(vehicle, getFmsStatus(vehicle), vehicle.returnAt)) : [
      { id: 'fahrzeug-1', name: 'RTW 1', type: 'RTW', stationId: 'rettungswache-zentrum', price: 0, callsign: 'RTW-1', status: 'Einsatzbereit', crewRequired: 2, assignedStaffIds: [] },
      { id: 'fahrzeug-2', name: 'LF 1', type: 'LF 10', stationId: undefined, price: 0, callsign: 'LF-1', status: 'Einsatzbereit', crewRequired: 3, assignedStaffIds: [] },
    ]);
    setIncidents(nextState.incidents ?? []);
    setSelectedId((nextState.locations.find((location) => location.type === 'station')?.id) ?? initialLocations[0].id);
    setGameStateLoaded(true);
    return true;
  };

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [completedIncidentHistory, setCompletedIncidentHistory] = useState<CompletedIncident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [mapLayer, setMapLayer] = useState<MapLayerMode>('Karte');

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

        const nextIncidents = [nextIncident, ...current];
        persistSimulation(nextIncidents, vehicles);
        return nextIncidents;
      });
    }, GAME_CONFIG.incidentGenerationMs);

    return () => clearInterval(interval);
  }, [locations, incidents, vehicles]);

  useEffect(() => {
    if (draftStationKind === 'Rettungswache') setDraftStartVehicleType('RTW');
    else setDraftStartVehicleType('LF 10');
  }, [draftStationKind]);

  useEffect(() => {
    if (!gameStateLoaded) return;
    let changed = false;
    const nextVehicles: Vehicle[] = vehicles.map((vehicle): Vehicle => {
      const activeIncident = incidents.find(
        (incident) => incident.status !== 'Abgeschlossen' && incident.alarmedVehicles.some((entry) => entry.vehicleId === vehicle.id),
      );

      if (!activeIncident) {
        if (getFmsStatus(vehicle) === 1 && vehicle.returnAt && nowMs >= vehicle.returnAt) {
          changed = true;
          return withFmsStatus(vehicle, 2);
        }
        return vehicle;
      }

      const assignment = activeIncident.alarmedVehicles.find((entry) => entry.vehicleId === vehicle.id);
      if (!assignment) return vehicle;
      if (getFmsStatus(vehicle) === 5 && vehicle.speechRequest) return vehicle;
      const nextStatus: FmsStatus = nowMs >= assignment.arrivalAt ? 4 : 3;
      if (getFmsStatus(vehicle) !== nextStatus) {
        changed = true;
        return withFmsStatus(vehicle, nextStatus);
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
        const matchingVehicleIds = new Set(activeVehicles.filter((vehicle) => vehicleMeetsRequirement(vehicle.type, requirement)).map((vehicle) => vehicle.id));
        const matches = matchingVehicleIds.size;
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

      completed.forEach((incident) => {
        fetch('/api/game-state/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ incident: completedHistoryEntries.find((entry) => entry.id === incident.id), reward: incident.reward }),
        })
          .then((response) => {
            if (!response.ok) throw new Error('Einsatzabschluss konnte nicht gespeichert werden.');
            return response.json() as Promise<{ balance: number; transactions: FinanceTransaction[]; completedIncidents: CompletedIncident[] }>;
          })
          .then((state) => {
            setBalance(state.balance);
            setTransactions(state.transactions);
            setCompletedIncidentHistory(state.completedIncidents);
          })
          .catch((error) => console.error(error));
      });
      const completedVehicles = nextVehicles.map((vehicle) => {
        const isCompleted = completed.some((incident) =>
          incident.alarmedVehicles.some((assignment) => assignment.vehicleId === vehicle.id),
        );
        if (!isCompleted) return vehicle;
        const assignment = completed
          .flatMap((incident) => incident.alarmedVehicles)
          .find((entry) => entry.vehicleId === vehicle.id);
        return withFmsStatus(vehicle, 1, nowMs + (assignment?.etaSeconds ?? 1) * 1000);
      });
      setVehicles(completedVehicles);
      setIncidents((current) => current.filter((incident) => !completed.some((item) => item.id === incident.id)));
      setSelectedIncidentId((current) => (current && completed.some((incident) => incident.id === current) ? null : current));
      persistSimulation(nextIncidents.filter((incident) => incident.status !== 'Abgeschlossen'), completedVehicles);
    }

    if (changed && completed.length === 0) {
      setVehicles(nextVehicles);
      setIncidents(nextIncidents.filter((incident) => incident.status !== 'Abgeschlossen'));
      persistSimulation(nextIncidents.filter((incident) => incident.status !== 'Abgeschlossen'), nextVehicles);
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
  const [currentView, setCurrentView] = useState<'Leitstelle'|'Karte'|'Wachen'|'Fahrzeuge'|'Einsätze'|'Finanzen'|'Einstellungen'>('Leitstelle');
  const [stationKindFilter, setStationKindFilter] = useState<'Rettungswache' | 'Feuerwache' | undefined>();
  const [incidentInitialTab, setIncidentInitialTab] = useState<'Aktive' | 'Abgeschlossen'>('Aktive');
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
    const vehiclePrice = Object.values(VEHICLE_CATALOG).flat().find((entry) => entry.type === draftStartVehicleType)?.price ?? 0;
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
      type: 'station',
      stationKind: draftStationKind,
      vehicleCapacity: getDefaultVehicleCapacity(draftStationKind),
      coords,
      description: draftStationKind === 'Feuerwache' ? 'Feuerwehr' : 'Rettungsdienst',
      details: address.trim() || 'Frei platzierbarer Rettungsstandort',
      price: stationPrice,
    };

    const nextVehicleId = `fahrzeug-${Date.now()}`;
    const nextVehicle = draftStartVehicleType ? {
      id: nextVehicleId,
      name: draftStartVehicleType,
      type: draftStartVehicleType,
      stationId: locationId,
      price: vehiclePrice,
      callsign: draftStartVehicleCallsign?.trim() || `${draftStartVehicleType} ${Date.now().toString().slice(-4)}`,
      status: 'Einsatzbereit' as const,
      fmsStatus: 2 as const,
      crewRequired: getVehicleCatalogEntry(draftStartVehicleType)?.technical.crewRequired ?? 0,
      assignedStaffIds: [] as string[],
    } : null;
    const nextLocations = [...locations, nextLocation];
    const nextVehicles = nextVehicle ? [...vehicles, nextVehicle] : vehicles;
    const staffForStation: Staff[] = draftStationKind === 'Feuerwache'
      ? [
        { id: `staff-${Date.now()}-f1`, name: 'Felix Brand', stationId: locationId, qualifications: ['firefighter', 'driver', 'first-responder'], inTraining: false },
        { id: `staff-${Date.now()}-f2`, name: 'Gabi Moser', stationId: locationId, qualifications: ['firefighter', 'driver'], inTraining: false },
        { id: `staff-${Date.now()}-f3`, name: 'Heinz Kram', stationId: locationId, qualifications: ['firefighter', 'first-responder'], inTraining: false },
      ]
      : [
        { id: `staff-${Date.now()}-r1`, name: 'Iris Neumann', stationId: locationId, qualifications: ['driver', 'medical'], inTraining: false },
        { id: `staff-${Date.now()}-r2`, name: 'Jonas Baum', stationId: locationId, qualifications: ['medical', 'first-responder'], inTraining: false },
        { id: `staff-${Date.now()}-r3`, name: 'Klara Essig', stationId: locationId, qualifications: ['driver'], inTraining: false },
      ];

    setLocations(nextLocations);
    setSelectedId(locationId);
    setVehicles(nextVehicles);
    setStaff((current) => [...current, ...staffForStation]);
    persistAssets(nextLocations, nextVehicles);
    setBalance((cur) => cur - totalCost);
    addTransaction('Ausgabe', `${draftStationKind} mit ${draftStartVehicleType} erstellt`, totalCost);

    // create the selected start vehicle (exactly one) and assign to the new station
    if (nextVehicle) {
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

    const nextLocations = locations.filter((location) => location.id !== id);
    setLocations(() => {
      // Wenn die gelöschte Location aktuell ausgewählt war, wähle die erste verbleibende
      if (selectedId === id) {
        setSelectedId(nextLocations[0]?.id ?? '');
      }
      return nextLocations;
    });
    persistAssets(nextLocations, vehicles);
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

    const nextIncidents = [newIncident, ...incidents];
    setIncidents(nextIncidents);
    persistSimulation(nextIncidents, vehicles);
    setSelectedIncidentId(newIncident.id);
    setCurrentView('Einsätze');
  };

  const alarmIncidentVehicles = (incidentId: string, selectedVehicleIds: string[]) => {
    if (selectedVehicleIds.length === 0) return;
    const incident = incidents.find((item) => item.id === incidentId);
    if (!incident || incident.status !== 'Offen') return;

    const nextVehicles = vehicles.map((vehicle) => ({ ...vehicle, assignedStaffIds: Array.isArray(vehicle.assignedStaffIds) ? [...vehicle.assignedStaffIds] : [] }));
    const reservedStaff = new Set<string>();
    const alarmedVehicleIds = new Set<string>();

    for (const vehicleId of selectedVehicleIds) {
      const vehicle = nextVehicles.find((item) => item.id === vehicleId);
      if (!vehicle || !isFmsAlarmable(getFmsStatus(vehicle), vehicle.previousOperationalStatus)) continue;
      const crewIds = getAvailableStaffForVehicle(vehicle, nextVehicles, staff).filter((id) => !reservedStaff.has(id));
      vehicle.assignedStaffIds = crewIds;
      crewIds.forEach((id) => reservedStaff.add(id));
      alarmedVehicleIds.add(vehicle.id);
    }

    const vehiclesToAssign = selectedVehicleIds
      .map((vehicleId) => {
        const vehicle = nextVehicles.find((item) => item.id === vehicleId);
        if (!vehicle || !alarmedVehicleIds.has(vehicle.id)) return null;
        const coords = getStationCoords(vehicle.stationId, locations);
        if (!coords) return null;
        const distance = haversineKm(coords, incident.coords);
        const etaSeconds = Math.max(1, Math.round((distance / GAME_CONFIG.averageSpeedKmh) * 3600));
        return { vehicleId, distanceKm: Number(distance.toFixed(1)), etaSeconds, arrivalAt: Date.now() + etaSeconds * 1000 } satisfies AlarmedVehicle;
      })
      .filter((entry): entry is AlarmedVehicle => Boolean(entry));

    const nextAlarmed = [...incident.alarmedVehicles, ...vehiclesToAssign.filter((entry) => !incident.alarmedVehicles.some((existing) => existing.vehicleId === entry.vehicleId))];
    const nextIncidents = incidents.map((item) => item.id === incidentId ? { ...item, alarmedVehicles: nextAlarmed, status: nextAlarmed.length > 0 ? 'Fahrzeuge alarmiert' as const : 'Offen' as const } : item);

    const updatedVehicles = nextVehicles.map((vehicle) => alarmedVehicleIds.has(vehicle.id) ? withFmsStatus(vehicle, 3) : vehicle);
    setIncidents(nextIncidents);
    setVehicles(updatedVehicles);
    setStaff((current) => current.map((member) => ({
      ...member,
      inTraining: member.inTraining,
    })));
    persistSimulation(nextIncidents, updatedVehicles);
  };

  const acknowledgeSpeechRequest = (vehicleId: string) => {
    const nextVehicles = vehicles.map((vehicle) => {
      if (vehicle.id !== vehicleId) return vehicle;
      if (!vehicle.speechRequest || getFmsStatus(vehicle) !== 5) return vehicle;
      return withFmsStatus(vehicle, vehicle.previousOperationalStatus ?? 2);
    });
    setVehicles(nextVehicles);
    persistSimulation(incidents, nextVehicles);
  };

  const toggleVehicleAvailability = (vehicleId: string) => {
    const nextVehicles = vehicles.map((vehicle) => {
      if (vehicle.id !== vehicleId) return vehicle;
      return getFmsStatus(vehicle) === 6 ? withFmsStatus(vehicle, 2) : withFmsStatus(vehicle, 6);
    });
    setVehicles(nextVehicles);
    persistSimulation(incidents, nextVehicles);
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

      <main className={`dashboard ${currentView === 'Karte' ? 'dashboard--map' : 'dashboard--workspace'}`}>
        {currentView === 'Karte' && <aside className="sidebar">
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
              <li>
                Koordinaten: {selectedLocation.coords[0].toFixed(4)}, {selectedLocation.coords[1].toFixed(4)}
              </li>
            </ul>
          </div>
        </aside>}

        {currentView === 'Karte' ? (
          <section className="map-panel">
            <div className="map-surface">
              <div className="map-layer-control" aria-label="Kartendarstellung wechseln">
                {(['Karte', 'Satellit'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`map-layer-button ${mapLayer === mode ? 'map-layer-button--active' : ''}`}
                    onClick={() => setMapLayer(mode)}
                    aria-pressed={mapLayer === mode}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <MapContainer center={[48.775, 9.185]} zoom={13} scrollWheelZoom className="map-view" ref={mapRef}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  opacity={mapLayer === 'Karte' ? 1 : 0}
                />
                <TileLayer
                  attribution='Tiles &copy; Esri'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  opacity={mapLayer === 'Satellit' ? 1 : 0}
                />

                <MapClickHandler onMapClick={handleMapClick} />
                <MapZoomTracker onZoomChange={setMapZoom} />

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
                  const stationIcon = location.stationKind === 'Feuerwache'
                    ? createFireStationIcon(mapZoom)
                    : createMarkerIcon(iconColor);

                  return (
                    <Marker
                      key={location.id}
                      position={location.coords}
                      icon={stationIcon}
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
            </div>
          </section>
        ) : (
          <section className="panel--secondary workspace-panel">
            {currentView === 'Wachen' && (
              <WachenView
                locations={locations}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                vehicles={vehicles}
                staff={staff}
                trainingCourses={trainingCourses}
                onStartTraining={startTraining}
                stationKindFilter={stationKindFilter}
                balance={balance}
                onPurchaseVehicle={purchaseVehicle}
                onPurchaseUpgrade={purchaseUpgrade}
              />
            )}

            {currentView === 'Leitstelle' && (
              <LeitstelleView
                incidents={incidents}
                locations={locations}
                vehicles={vehicles}
                balance={balance}
                activities={transactions}
                completedIncidents={completedIncidentHistory}
                onOpenActiveIncidents={() => { setSelectedIncidentId(null); setIncidentInitialTab('Aktive'); setCurrentView('Einsätze'); }}
                onOpenIncidents={(incidentId) => {
                  setSelectedIncidentId(incidentId);
                  setIncidentInitialTab('Aktive');
                  setCurrentView('Einsätze');
                }}
                onOpenCompletedIncident={(incidentId) => {
                  setSelectedIncidentId(incidentId);
                  setIncidentInitialTab('Abgeschlossen');
                  setCurrentView('Einsätze');
                }}
                onOpenWachen={() => { setStationKindFilter(undefined); setCurrentView('Wachen'); }}
                onOpenRescue={() => {
                  const rescueStation = locations.find((location) => location.type === 'station' && (location.stationKind ?? 'Rettungswache') === 'Rettungswache');
                  if (rescueStation) setSelectedId(rescueStation.id);
                  setStationKindFilter('Rettungswache');
                  setCurrentView('Wachen');
                }}
                onOpenFire={() => {
                  const fireStation = locations.find((location) => location.type === 'station' && location.stationKind === 'Feuerwache');
                  if (fireStation) setSelectedId(fireStation.id);
                  setStationKindFilter('Feuerwache');
                  setCurrentView('Wachen');
                }}
                onOpenVehicles={() => setCurrentView('Fahrzeuge')}
                onOpenFinances={() => setCurrentView('Finanzen')}
                onOpenMap={() => setCurrentView('Karte')}
                onOpenStation={(stationId) => {
                  setSelectedId(stationId);
                  setStationKindFilter(undefined);
                  setCurrentView('Wachen');
                }}
              />
            )}

            {currentView === 'Fahrzeuge' && (
              <FahrzeugeView vehicles={vehicles} addVehicle={addVehicle} stations={locations.filter(l => l.type === 'station')} onAcknowledgeSpeechRequest={acknowledgeSpeechRequest} onToggleAvailability={toggleVehicleAvailability} />
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
                initialTab={incidentInitialTab}
              />
            )}

            {currentView === 'Finanzen' && (
              <FinanzenView balance={balance} locations={locations} vehicles={vehicles} transactions={transactions} />
            )}

            {currentView === 'Einstellungen' && (
              <EinstellungenView
                defaultView={currentView}
                balance={balance}
                onSetBalance={updateBalance}
                locations={locations}
                onUpdateStationUpgradeLevel={updateStationUpgradeLevel}
                onResetGame={resetGameState}
              />
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
