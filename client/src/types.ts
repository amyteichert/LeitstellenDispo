export type LocationType = 'station' | 'incident';

export type StationKind = 'Rettungswache' | 'Feuerwache';

export type MapLocation = {
  id: string;
  name: string;
  type: LocationType;
  coords: [number, number];
  description: string;
  details: string;
  price?: number;
  vehicleCapacity?: number;
  upgradeLevels?: Record<string, number>;
  staffSatisfaction?: number;
  stationKind?: StationKind; // optional: for type === 'station' specifies whether it's a Rettungswache or Feuerwache
};
