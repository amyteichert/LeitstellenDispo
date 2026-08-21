export type LocationType = 'station' | 'incident';

export type MapLocation = {
  id: string;
  name: string;
  type: LocationType;
  coords: [number, number];
  description: string;
  details: string;
  price?: number;
};
