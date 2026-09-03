import cors from 'cors';
import express from 'express';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getAppInfo, getDefaultVehicleCapacity, type FmsStatus, type OperationalFmsStatus } from '@leitstellendispo/shared';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const gameStatePath = join(process.cwd(), 'data', 'game-state.json');

type CompletedIncident = {
  id: string;
  [key: string]: unknown;
};

type FinanceTransaction = {
  id: string;
  kind: 'Einnahme' | 'Ausgabe';
  label: string;
  amount: number;
  createdAt: string;
};

type GameState = {
  balance: number;
  transactions: FinanceTransaction[];
  completedIncidents: CompletedIncident[];
  locations: unknown[];
  vehicles: unknown[];
  incidents: unknown[];
  trainingCourses: unknown[];
};

const createInitialGameState = (): GameState => ({
  balance: 0,
  transactions: [{
    id: 'initial-balance',
    kind: 'Einnahme',
    label: 'Startguthaben',
    amount: 0,
    createdAt: new Date().toISOString(),
  }],
  completedIncidents: [],
  locations: [
    {
      id: 'rettungswache-zentrum',
      name: 'Rettungswache Zentrum',
      type: 'station',
      stationKind: 'Rettungswache',
      coords: [48.775, 9.1771],
      description: 'Rettungsdienst',
      details: 'Frei platzierbarer Standort',
      price: 0,
      vehicleCapacity: 2,
      upgradeLevels: {},
      staffSatisfaction: 100,
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
      vehicleCapacity: 2,
      upgradeLevels: {},
      staffSatisfaction: 100,
    },
  ],
  vehicles: [
    { id: 'fahrzeug-1', name: 'RTW 1', type: 'RTW', stationId: 'rettungswache-zentrum', price: 0, callsign: 'RTW-1', status: 'Einsatzbereit', fmsStatus: 2 },
    { id: 'fahrzeug-2', name: 'LF 1', type: 'LF 10', stationId: undefined, price: 0, callsign: 'LF-1', status: 'Einsatzbereit', fmsStatus: 2 },
  ],
  incidents: [],
  trainingCourses: [],
});

type PersistedVehicle = {
  fmsStatus?: FmsStatus;
  speechRequest?: boolean;
  previousOperationalStatus?: OperationalFmsStatus;
  assignedStaffIds?: string[];
  crewRequired?: number;
  [key: string]: unknown;
};

type PersistedLocation = {
  type?: string;
  stationKind?: 'Rettungswache' | 'Feuerwache';
  vehicleCapacity?: number;
  upgradeLevels?: Record<string, number>;
  staffSatisfaction?: number;
  [key: string]: unknown;
};

const defaultGameState: GameState = {
  balance: 0,
  transactions: [{
    id: 'initial-balance',
    kind: 'Einnahme',
    label: 'Startguthaben',
    amount: 0,
    createdAt: new Date().toISOString(),
  }],
  completedIncidents: [],
  locations: [],
  vehicles: [],
  incidents: [],
  trainingCourses: [],
};

const migrateVehicles = (vehicles: unknown[]): unknown[] => vehicles.map((item) => {
  if (!item || typeof item !== 'object') return item;
  const vehicle = item as PersistedVehicle;
  return {
    ...vehicle,
    fmsStatus: vehicle.fmsStatus ?? 2,
    speechRequest: vehicle.speechRequest ?? false,
    assignedStaffIds: Array.isArray(vehicle.assignedStaffIds) ? vehicle.assignedStaffIds : [],
    crewRequired: typeof vehicle.crewRequired === 'number' ? vehicle.crewRequired : undefined,
  };
});

const migrateLocations = (locations: unknown[]): unknown[] => locations.map((item) => {
  if (!item || typeof item !== 'object') return item;
  const location = item as PersistedLocation;
  if (location.type !== 'station') return location;
  const stationKind = location.stationKind ?? (location.description === 'Feuerwehr' ? 'Feuerwache' : 'Rettungswache');
  return {
    ...location,
    stationKind,
    vehicleCapacity: location.vehicleCapacity ?? getDefaultVehicleCapacity(stationKind),
    upgradeLevels: location.upgradeLevels ?? {},
    staffSatisfaction: location.staffSatisfaction ?? 100,
  };
});

const migrateTrainingCourses = (trainingCourses: unknown[]): unknown[] => trainingCourses.map((item) => {
  if (!item || typeof item !== 'object') return item;
  const course = item as Record<string, unknown> & { participantIds?: unknown[] };
  return {
    ...course,
    participantIds: Array.isArray(course.participantIds) ? course.participantIds.filter((participantId): participantId is string => typeof participantId === 'string') : [],
    durationSeconds: typeof course.durationSeconds === 'number' ? course.durationSeconds : undefined,
    endsAt: typeof course.endsAt === 'string' ? course.endsAt : undefined,
    completedAt: typeof course.completedAt === 'string' ? course.completedAt : undefined,
  };
});

const loadGameState = async (): Promise<GameState> => {
  try {
    const stored = JSON.parse(await readFile(gameStatePath, 'utf8')) as Partial<GameState>;
    return {
      balance: typeof stored.balance === 'number' ? stored.balance : defaultGameState.balance,
      transactions: Array.isArray(stored.transactions) ? stored.transactions : defaultGameState.transactions,
      completedIncidents: Array.isArray(stored.completedIncidents) ? stored.completedIncidents : [],
      locations: migrateLocations(Array.isArray(stored.locations) ? stored.locations : []),
      vehicles: migrateVehicles(Array.isArray(stored.vehicles) ? stored.vehicles : []),
      incidents: Array.isArray(stored.incidents) ? stored.incidents : [],
      trainingCourses: migrateTrainingCourses(Array.isArray(stored.trainingCourses) ? stored.trainingCourses : []),
    };
  } catch {
    await mkdir(dirname(gameStatePath), { recursive: true });
    await writeFile(gameStatePath, JSON.stringify(defaultGameState, null, 2));
    return defaultGameState;
  }
};

let gameState = await loadGameState();
let stateWrite = Promise.resolve();

const persistGameState = () => {
  stateWrite = stateWrite.then(async () => {
    await mkdir(dirname(gameStatePath), { recursive: true });
    await writeFile(gameStatePath, JSON.stringify(gameState, null, 2));
  });
  return stateWrite;
};

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/info', (_req, res) => {
  res.json(getAppInfo());
});

app.get('/api/game-state', (_req, res) => {
  res.json(gameState);
});

app.put('/api/game-state/assets', async (req, res) => {
  if (!Array.isArray(req.body?.locations) || !Array.isArray(req.body?.vehicles)) {
    res.status(400).json({ error: 'Ungültige Standort- oder Fahrzeugdaten.' });
    return;
  }

  const locations = migrateLocations(req.body.locations);
  const stationCapacities = new Map(locations.filter((location): location is PersistedLocation => Boolean(location && typeof location === 'object' && (location as PersistedLocation).type === 'station')).map((location) => [location.id as string, location.vehicleCapacity ?? getDefaultVehicleCapacity(location.stationKind)]));
  const vehicleCounts = new Map<string, number>();
  for (const vehicle of req.body.vehicles as Array<{ stationId?: string }>) {
    if (vehicle.stationId) vehicleCounts.set(vehicle.stationId, (vehicleCounts.get(vehicle.stationId) ?? 0) + 1);
  }
  for (const [stationId, count] of vehicleCounts) {
    if (count > (stationCapacities.get(stationId) ?? 0)) {
      res.status(409).json({ error: 'Die Stellplatzkapazität der Wache ist überschritten.' });
      return;
    }
  }

  gameState.locations = locations;
  gameState.vehicles = migrateVehicles(req.body.vehicles);
  gameState.trainingCourses = migrateTrainingCourses(Array.isArray(req.body.trainingCourses) ? req.body.trainingCourses : gameState.trainingCourses ?? []);
  await persistGameState();
  res.json(gameState);
});

app.put('/api/game-state/simulation', async (req, res) => {
  if (!Array.isArray(req.body?.incidents) || !Array.isArray(req.body?.vehicles)) {
    res.status(400).json({ error: 'Ungültige Einsatz- oder Fahrzeugdaten.' });
    return;
  }

  gameState.incidents = req.body.incidents;
  gameState.vehicles = migrateVehicles(req.body.vehicles);
  await persistGameState();
  res.json({ incidents: gameState.incidents, vehicles: gameState.vehicles });
});

app.put('/api/game-state/finance', async (req, res) => {
  if (typeof req.body?.balance !== 'number' || !Number.isFinite(req.body.balance) || !Array.isArray(req.body?.transactions)) {
    res.status(400).json({ error: 'Ungültige Finanzdaten.' });
    return;
  }

  gameState.balance = req.body.balance;
  gameState.transactions = req.body.transactions;
  await persistGameState();
  res.json({ balance: gameState.balance, transactions: gameState.transactions });
});

app.post('/api/game-state/reset', async (_req, res) => {
  gameState = createInitialGameState();
  await persistGameState();
  res.json(gameState);
});

app.post('/api/game-state/completions', async (req, res) => {
  const incident = req.body?.incident as CompletedIncident | undefined;
  const reward = req.body?.reward;

  if (!incident?.id || typeof reward !== 'number' || !Number.isFinite(reward) || reward < 0) {
    res.status(400).json({ error: 'Ungültige Abschlussdaten.' });
    return;
  }

  const alreadyCompleted = gameState.completedIncidents.some((item) => item.id === incident.id);
  if (!alreadyCompleted) {
    gameState.completedIncidents = [incident, ...gameState.completedIncidents].slice(0, 100);
    gameState.balance += reward;
    gameState.transactions = [{
      id: `txn-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: 'Einnahme',
      label: `${incident.organization ?? 'Einsatz'} – ${incident.type ?? incident.id} abgeschlossen`,
      amount: reward,
      createdAt: new Date().toISOString(),
    }, ...gameState.transactions];
    await persistGameState();
  }

  res.json(gameState);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LeitstellenDispo Server läuft auf Port ${PORT}`);
});
