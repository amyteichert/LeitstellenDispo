import type { StationKind } from './types';

export type UpgradeCategory =
  | 'Stellplätze'
  | 'Erweiterungen'
  | 'Lagerkapazität'
  | 'Personalbereiche'
  | 'Aufenthaltsraum'
  | 'Ruheräume'
  | 'Küche'
  | 'Fitnessraum'
  | 'Ausbildungsbereich'
  | 'Werkstatt';

export type UpgradeDefinition = {
  id: string;
  category: UpgradeCategory;
  name: string;
  description: string;
  maxLevel: number;
  allowedStationKinds: StationKind[];
  prerequisites?: string[];
  effect: {
    vehicleCapacityIncrease?: number;
    staffSatisfactionCapacity?: number;
  };
  priceByNextLevel?: Partial<Record<number, number>>;
  available: boolean;
};

export const UPGRADE_CATALOG: UpgradeDefinition[] = [
  {
    id: 'vehicle-capacity',
    category: 'Stellplätze',
    name: 'Stellplatz erweitern',
    description: 'Schafft einen zusätzlichen Stellplatz für ein weiteres Einsatzfahrzeug.',
    maxLevel: 99,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: { vehicleCapacityIncrease: 1 },
    priceByNextLevel: {
      1: 60000,
      2: 90000,
      3: 135000,
    },
    available: true,
  },
  {
    id: 'ausbildungsbereich',
    category: 'Ausbildungsbereich',
    name: 'Ausbildungsbereich',
    description: 'Hier kann später Personal ausgebildet werden.',
    maxLevel: 1,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    priceByNextLevel: {
      1: 250000,
    },
    available: true,
  },
  {
    id: 'ausbildungsraum',
    category: 'Ausbildungsbereich',
    name: 'Zusätzlicher Ausbildungsraum',
    description: 'Ermöglicht einen weiteren parallelen Lehrgang im Ausbildungsbereich.',
    maxLevel: 3,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    priceByNextLevel: {
      1: 180000,
      2: 240000,
      3: 320000,
    },
    available: true,
  },
  ...(['Erweiterungen', 'Lagerkapazität', 'Personalbereiche', 'Aufenthaltsraum', 'Ruheräume', 'Küche', 'Fitnessraum', 'Werkstatt'] as UpgradeCategory[]).map((category): UpgradeDefinition => ({
    id: category.toLowerCase().replace(/ä/g, 'a'),
    category,
    name: category,
    description: 'Für eine spätere Ausbaustufe vorbereitet.',
    maxLevel: 1,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    available: false,
  })),
];

export const getUpgradeDefinition = (id: string) => UPGRADE_CATALOG.find((upgrade) => upgrade.id === id);
export const getAvailableUpgrades = (stationKind: StationKind) => UPGRADE_CATALOG.filter((upgrade) => upgrade.available && upgrade.allowedStationKinds.includes(stationKind));
export const getUpgradePrice = (upgrade: UpgradeDefinition, nextLevel: number) => upgrade.priceByNextLevel?.[nextLevel];
