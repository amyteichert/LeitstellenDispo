export type LocationType = 'station' | 'incident';

export type StationKind = 'Rettungswache' | 'Feuerwache';

export type StationStaffMember = {
  id: string;
  name: string;
  stationId: string;
  qualifications: string[];
  assignedVehicleId?: string;
  inTraining?: boolean;
  trainingCourseId?: string;
};

export type ActiveTrainingSession = {
  id: string;
  stationId: string;
  courseType: string;
  participants: string[];
  startedAt: number;
  endsAt: number;
  cost: number;
  status: 'planned' | 'active' | 'completed' | 'failed';
};

export type MapLocation = {
  id: string;
  name: string;
  type: LocationType;
  kind?: StationKind;
  coords: [number, number];
  description: string;
  details: string;
  address?: string;
  price?: number;
  vehicleCapacity?: number;
  upgradeLevels?: Record<string, number>;
  staffSatisfaction?: number;
  stationKind?: StationKind; // optional: for type === 'station' specifies whether it's a Rettungswache or Feuerwache
  staffMembers?: StationStaffMember[];
  activeTrainings?: ActiveTrainingSession[];
  trainingRoomCount?: number;
  completedTrainingIds?: string[];
  owned?: boolean;
  city?: string;
  postalCode?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  purchasePrice?: number;
  isAvailable?: boolean;
  isOwned?: boolean;
};
