import { getVehicleCatalogEntry } from './vehicleCatalog';
import type { MapLocation, StationStaffMember } from './types';

export const createDefaultStaffMembers = (stationId: string): StationStaffMember[] => [
  { id: `${stationId}-staff-1`, name: 'Leitungskraft', stationId, qualifications: ['leadership', 'emergencyMedical'], assignedVehicleId: undefined },
  { id: `${stationId}-staff-2`, name: 'Ausbildungsleiter', stationId, qualifications: ['emergencyMedical', 'technicalRescue'], assignedVehicleId: undefined },
  { id: `${stationId}-staff-3`, name: 'Einsatzkraft', stationId, qualifications: ['firefighting', 'waterSupply'], assignedVehicleId: undefined },
  { id: `${stationId}-staff-4`, name: 'Sanitäter', stationId, qualifications: ['emergencyMedical', 'patientTransport'], assignedVehicleId: undefined },
];

export const normalizeStaffMember = (member: Partial<StationStaffMember> & { id: string; name: string; stationId: string }): StationStaffMember => ({
  id: member.id,
  name: member.name,
  stationId: member.stationId,
  qualifications: Array.isArray(member.qualifications) ? member.qualifications : [],
  assignedVehicleId: member.assignedVehicleId,
  inTraining: Boolean(member.inTraining),
  trainingCourseId: member.trainingCourseId,
});

export const normalizeStationLocation = (location: Partial<MapLocation> = {}): MapLocation => {
  if (!location || location.type !== 'station') {
    return location as MapLocation;
  }

  const safeId = location.id ?? 'station';

  return {
    ...location,
    type: 'station' as const,
    id: safeId,
    name: location.name ?? 'Neue Wache',
    coords: location.coords ?? [48.775, 9.1771],
    description: location.description ?? 'Wache',
    details: location.details ?? 'Wachenstandort',
    stationKind: location.stationKind ?? 'Rettungswache',
    vehicleCapacity: location.vehicleCapacity ?? 2,
    upgradeLevels: location.upgradeLevels ?? {},
    staffSatisfaction: location.staffSatisfaction ?? 100,
    trainingRoomCount: location.trainingRoomCount ?? 0,
    activeTrainings: Array.isArray(location.activeTrainings) ? location.activeTrainings : [],
    completedTrainingIds: Array.isArray(location.completedTrainingIds) ? location.completedTrainingIds : [],
    staffMembers: Array.isArray(location.staffMembers)
      ? location.staffMembers.map((member) => normalizeStaffMember(member))
      : createDefaultStaffMembers(safeId),
  } satisfies MapLocation;
};

export const getAssignedStaffIds = (vehicles: Array<{ id?: string; assignedStaffIds?: string[] }>, excludeVehicleId?: string): Set<string> => {
  const assignedIds = new Set<string>();
  for (const vehicle of vehicles) {
    if (excludeVehicleId && vehicle.id === excludeVehicleId) continue;
    for (const staffId of vehicle.assignedStaffIds ?? []) {
      assignedIds.add(staffId);
    }
  }
  return assignedIds;
};

export const getEligibleStaff = (
  station: MapLocation | undefined,
  requiredQualifications: string[] = [],
  reservedStaffIds: Set<string> = new Set(),
  staffMembers: StationStaffMember[] = station?.staffMembers ?? [],
): StationStaffMember[] => {
  if (!station || station.type !== 'station') return [];

  return [...(staffMembers ?? [])]
    .filter((member) => member.stationId === station.id)
    .filter((member) => !member.inTraining)
    .filter((member) => !member.assignedVehicleId)
    .filter((member) => !reservedStaffIds.has(member.id))
    .filter((member) => requiredQualifications.every((qualification) =>
      member.qualifications.includes(qualification) || member.qualifications.includes(qualification.toLowerCase())
    ) || requiredQualifications.length === 0)
    .sort((a, b) => {
      const aScore = requiredQualifications.filter((qualification) => a.qualifications.includes(qualification)).length;
      const bScore = requiredQualifications.filter((qualification) => b.qualifications.includes(qualification)).length;
      if (bScore !== aScore) return bScore - aScore;
      return a.name.localeCompare(b.name);
    });
};

export const selectCrewForVehicle = (
  station: MapLocation | undefined,
  vehicleType: string | undefined,
  reservedStaffIds: Set<string> = new Set(),
  staffMembers: StationStaffMember[] = station?.staffMembers ?? [],
  minimumCrewCount?: number,
): string[] | null => {
  if (!station || station.type !== 'station') return null;
  const entry = getVehicleCatalogEntry(vehicleType);
  const requiredQualifications = entry?.technical.requiredQualifications ?? [];
  const targetCrewCount = Math.max(minimumCrewCount ?? entry?.technical.crewRequired ?? 1, 1);
  const maxCrewCount = Math.max(entry?.technical.crewCapacity ?? targetCrewCount, targetCrewCount);

  const available = [...staffMembers]
    .filter((staff) => staff.stationId === station.id)
    .filter((staff) => !staff.inTraining)
    .filter((staff) => !staff.assignedVehicleId)
    .filter((staff) => !reservedStaffIds.has(staff.id))
    .sort((a, b) => {
      const aScore = requiredQualifications.filter((qualification) => a.qualifications.includes(qualification)).length;
      const bScore = requiredQualifications.filter((qualification) => b.qualifications.includes(qualification)).length;
      if (bScore !== aScore) return bScore - aScore;
      if (requiredQualifications.length === 0) {
        return a.qualifications.length - b.qualifications.length || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });

  if (available.length < targetCrewCount) return null;

  const selected = new Set<string>();
  for (const requirement of requiredQualifications) {
    const match = available.find((staff) => !selected.has(staff.id) && staff.qualifications.some((qualification) => qualification.toLowerCase() === requirement.toLowerCase()));
    if (match) selected.add(match.id);
  }

  if (requiredQualifications.length > 0 && selected.size < requiredQualifications.length) {
    return null;
  }

  while (selected.size < targetCrewCount) {
    const next = available.find((staff) => !selected.has(staff.id));
    if (!next) break;
    selected.add(next.id);
  }

  if (selected.size < targetCrewCount) return null;
  if (selected.size > maxCrewCount) return null;

  return Array.from(selected).slice(0, targetCrewCount);
};
