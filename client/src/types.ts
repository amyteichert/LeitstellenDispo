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
  stationKind?: StationKind; // optional: for type === 'station' specifies whether it's a Rettungswache or Feuerwache
};
