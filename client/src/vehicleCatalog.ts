import type { FmsStatus } from '@leitstellendispo/shared';

export type VehicleCatalogCategory = 'Löschfahrzeuge' | 'Rettungsfahrzeuge';

export type VehicleCapability =
  | 'firefighting'
  | 'waterSupply'
  | 'patientTransport'
  | 'emergencyMedical'
  | 'technicalRescue'
  | 'waterPumping';

export type VehicleRequirement = {
  id: string;
  type: 'capability' | 'vehicleType';
  value: VehicleCapability | string;
  amount: number;
  label: string;
};

export type VehicleEquipmentProfile = {
  firefightingPump?: boolean;
  submersiblePump?: boolean;
  foamSystem?: boolean;
  breathingApparatus?: boolean;
  hydraulicRescueSet?: boolean;
  ladderEquipment?: boolean;
  generator?: boolean;
};

export type VehicleTechnicalData = {
  crewRequired: number;
  crewCapacity: number;
  patientCapacity: number;
  waterTankLiters: number;
  foamTankLiters: number;
  pumpLitersPerMinute: number;
  capabilities: VehicleCapability[];
  requiredQualifications?: string[];
  equipment?: VehicleEquipmentProfile;
};

export type VehicleCatalogEntry = {
  type: string;
  category: VehicleCatalogCategory;
  description: string;
  price: number;
  organization: 'Feuerwehr' | 'Rettungsdienst';
  initialFmsStatus: FmsStatus;
  technical: VehicleTechnicalData;
  unlock: {
    stationKinds: Array<'Rettungswache' | 'Feuerwache'>;
    requiredStationCount?: number;
    requiredExpansions?: string[];
    requiredTrainings?: string[];
  };
};

export const VEHICLE_CATALOG: Record<VehicleCatalogCategory, VehicleCatalogEntry[]> = {
  Löschfahrzeuge: [
    { type: 'LF 10', category: 'Löschfahrzeuge', description: 'Kompaktes Löschfahrzeug für kleinere Brände und technische Hilfeleistungen.', price: 15000, organization: 'Feuerwehr', initialFmsStatus: 2, technical: { crewRequired: 3, crewCapacity: 9, patientCapacity: 0, waterTankLiters: 1200, foamTankLiters: 0, pumpLitersPerMinute: 1000, capabilities: ['firefighting', 'waterSupply', 'waterPumping'], requiredQualifications: ['firefighter', 'driver'], equipment: { firefightingPump: true } }, unlock: { stationKinds: ['Feuerwache'] } },
    { type: 'LF 20', category: 'Löschfahrzeuge', description: 'Vielseitiges Löschgruppenfahrzeug für den täglichen Feuerwehreinsatz.', price: 25000, organization: 'Feuerwehr', initialFmsStatus: 2, technical: { crewRequired: 3, crewCapacity: 9, patientCapacity: 0, waterTankLiters: 2000, foamTankLiters: 0, pumpLitersPerMinute: 2000, capabilities: ['firefighting', 'waterSupply', 'waterPumping'], requiredQualifications: ['firefighter', 'driver'], equipment: { firefightingPump: true } }, unlock: { stationKinds: ['Feuerwache'] } },
    { type: 'TLF 2000', category: 'Löschfahrzeuge', description: 'Tanklöschfahrzeug mit zusätzlichem Löschwasservorrat für Brandeinsätze.', price: 30000, organization: 'Feuerwehr', initialFmsStatus: 2, technical: { crewRequired: 3, crewCapacity: 3, patientCapacity: 0, waterTankLiters: 2000, foamTankLiters: 200, pumpLitersPerMinute: 1000, capabilities: ['firefighting', 'waterSupply'], requiredQualifications: ['firefighter', 'driver'], equipment: { firefightingPump: true, foamSystem: true } }, unlock: { stationKinds: ['Feuerwache'] } },
    { type: 'TLF 3000', category: 'Löschfahrzeuge', description: 'Leistungsstarkes Tanklöschfahrzeug für größere Einsatzlagen.', price: 40000, organization: 'Feuerwehr', initialFmsStatus: 2, technical: { crewRequired: 3, crewCapacity: 3, patientCapacity: 0, waterTankLiters: 3000, foamTankLiters: 200, pumpLitersPerMinute: 2000, capabilities: ['firefighting', 'waterSupply'], requiredQualifications: ['firefighter', 'driver'], equipment: { firefightingPump: true, foamSystem: true } }, unlock: { stationKinds: ['Feuerwache'] } },
    { type: 'TLF 4000', category: 'Löschfahrzeuge', description: 'Großes Tanklöschfahrzeug für lange Löschwasserversorgung und Speziallagen.', price: 50000, organization: 'Feuerwehr', initialFmsStatus: 2, technical: { crewRequired: 3, crewCapacity: 3, patientCapacity: 0, waterTankLiters: 4000, foamTankLiters: 500, pumpLitersPerMinute: 3000, capabilities: ['firefighting', 'waterSupply'], requiredQualifications: ['firefighter', 'driver'], equipment: { firefightingPump: true, foamSystem: true } }, unlock: { stationKinds: ['Feuerwache'] } },
  ],
  Rettungsfahrzeuge: [
    { type: 'RTW', category: 'Rettungsfahrzeuge', description: 'Rettungswagen für die medizinische Erstversorgung und den Transport von Patienten.', price: 25000, organization: 'Rettungsdienst', initialFmsStatus: 2, technical: { crewRequired: 2, crewCapacity: 2, patientCapacity: 1, waterTankLiters: 0, foamTankLiters: 0, pumpLitersPerMinute: 0, capabilities: ['emergencyMedical', 'patientTransport'], requiredQualifications: ['driver', 'medical'] }, unlock: { stationKinds: ['Rettungswache'] } },
  ],
};

export const getAvailableVehicleCategories = (stationKind: 'Rettungswache' | 'Feuerwache') =>
  VEHICLE_CATALOG_CATEGORIES.filter((category) => VEHICLE_CATALOG[category].some((vehicle) => vehicle.unlock.stationKinds.includes(stationKind)));

export const getVehicleCatalogEntry = (type?: string) =>
  Object.values(VEHICLE_CATALOG).flat().find((vehicle) => vehicle.type === type);

export const vehicleMeetsRequirement = (vehicleType: string | undefined, requirement: VehicleRequirement) => {
  if (requirement.type === 'vehicleType') return vehicleType === requirement.value;
  return getVehicleCatalogEntry(vehicleType)?.technical.capabilities.includes(requirement.value as VehicleCapability) ?? false;
};

export const VEHICLE_CATALOG_CATEGORIES = Object.keys(VEHICLE_CATALOG) as VehicleCatalogCategory[];
