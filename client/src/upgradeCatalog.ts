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

export type UpgradeGroup =
  | 'Gebäude & Infrastruktur'
  | 'Ausstattung & Aufenthalt'
  | 'Betrieb & Einsatzbereitschaft';

export type UpgradeDefinition = {
  id: string;
  category: UpgradeCategory;
  group: UpgradeGroup;
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
    group: 'Gebäude & Infrastruktur',
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
    id: 'erweiterungen',
    category: 'Erweiterungen',
    group: 'Gebäude & Infrastruktur',
    name: 'Erweiterungen',
    description: 'Für eine spätere Ausbaustufe vorbereitet.',
    maxLevel: 1,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    available: false,
  },
  {
    id: 'lagerkapazitaet',
    category: 'Lagerkapazität',
    group: 'Gebäude & Infrastruktur',
    name: 'Lagerkapazität',
    description: 'Für eine spätere Ausbaustufe vorbereitet.',
    maxLevel: 1,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    available: false,
  },
  {
    id: 'personalbereiche',
    category: 'Personalbereiche',
    group: 'Betrieb & Einsatzbereitschaft',
    name: 'Personalbereiche',
    description: 'Für eine spätere Ausbaustufe vorbereitet.',
    maxLevel: 1,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    available: false,
  },
  {
    id: 'aufenthaltsraum',
    category: 'Aufenthaltsraum',
    group: 'Ausstattung & Aufenthalt',
    name: 'Aufenthaltsraum',
    description: 'Für eine spätere Ausbaustufe vorbereitet.',
    maxLevel: 1,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    available: false,
  },
  {
    id: 'ruheraeume',
    category: 'Ruheräume',
    group: 'Ausstattung & Aufenthalt',
    name: 'Ruheräume',
    description: 'Für eine spätere Ausbaustufe vorbereitet.',
    maxLevel: 1,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    available: false,
  },
  {
    id: 'kueche',
    category: 'Küche',
    group: 'Ausstattung & Aufenthalt',
    name: 'Küche',
    description: 'Für eine spätere Ausbaustufe vorbereitet.',
    maxLevel: 1,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    available: false,
  },
  {
    id: 'fitnessraum',
    category: 'Fitnessraum',
    group: 'Ausstattung & Aufenthalt',
    name: 'Fitnessraum',
    description: 'Für eine spätere Ausbaustufe vorbereitet.',
    maxLevel: 1,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    available: false,
  },
  {
    id: 'ausbildungsbereich',
    category: 'Ausbildungsbereich',
    group: 'Betrieb & Einsatzbereitschaft',
    name: 'Ausbildungsbereich',
    description: 'Für eine spätere Ausbaustufe vorbereitet.',
    maxLevel: 1,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    available: false,
  },
  {
    id: 'werkstatt',
    category: 'Werkstatt',
    group: 'Betrieb & Einsatzbereitschaft',
    name: 'Werkstatt',
    description: 'Für eine spätere Ausbaustufe vorbereitet.',
    maxLevel: 1,
    allowedStationKinds: ['Rettungswache', 'Feuerwache'],
    effect: {},
    available: false,
  },
];

export const getUpgradeDefinition = (id: string) => UPGRADE_CATALOG.find((upgrade) => upgrade.id === id);
export const getAvailableUpgrades = (stationKind: StationKind) => UPGRADE_CATALOG.filter((upgrade) => upgrade.available && upgrade.allowedStationKinds.includes(stationKind));
export const getUpgradePrice = (upgrade: UpgradeDefinition, nextLevel: number) => upgrade.priceByNextLevel?.[nextLevel];

export const UPGRADE_GROUP_ORDER: UpgradeGroup[] = [
  'Gebäude & Infrastruktur',
  'Ausstattung & Aufenthalt',
  'Betrieb & Einsatzbereitschaft',
];

export const getGroupedUpgrades = () =>
  UPGRADE_GROUP_ORDER.map((group) => ({
    group,
    upgrades: UPGRADE_CATALOG.filter((upgrade) => upgrade.group === group),
  }));
