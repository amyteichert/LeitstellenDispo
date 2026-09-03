export type TrainingCatalogEntry = {
  id: string;
  name: string;
  category: 'Feuerwehr' | 'Rettungsdienst' | 'Gemeinsam';
  description: string;
  stationKinds: Array<'Rettungswache' | 'Feuerwache'>;
  participantLimit: number;
  requiredQualification: string;
  durationSeconds: number;
};

export const MAX_TRAINING_PARTICIPANTS = 10;

export const TRAINING_CATALOG: TrainingCatalogEntry[] = [
  {
    id: 'grundausbildung-feuerwehr',
    name: 'Grundausbildung Feuerwehr',
    category: 'Feuerwehr',
    description: 'Einheitliche Schulung für Einsatzkräfte der Feuerwehr.',
    stationKinds: ['Feuerwache'],
    participantLimit: 10,
    requiredQualification: 'firefighter',
    durationSeconds: 90,
  },
  {
    id: 'fahrerqualifikation',
    name: 'Fahrerqualifikation',
    category: 'Gemeinsam',
    description: 'Spezialtraining für die sichere Fahrzeugführung.',
    stationKinds: ['Rettungswache', 'Feuerwache'],
    participantLimit: 10,
    requiredQualification: 'driver',
    durationSeconds: 120,
  },
  {
    id: 'erste-hilfe',
    name: 'Erste-Hilfe-Ausbildung',
    category: 'Rettungsdienst',
    description: 'Medizinische Grundschulung für Rettungsdienstmitarbeiter.',
    stationKinds: ['Rettungswache'],
    participantLimit: 10,
    requiredQualification: 'medical',
    durationSeconds: 75,
  },
  {
    id: 'first-responder',
    name: 'First Responder',
    category: 'Gemeinsam',
    description: 'Ausbildung zur Erstanamnese und schnellen Einsatzreaktion.',
    stationKinds: ['Rettungswache', 'Feuerwache'],
    participantLimit: 10,
    requiredQualification: 'first-responder',
    durationSeconds: 105,
  },
];

export const getTrainingCatalogEntry = (id: string) =>
  TRAINING_CATALOG.find((training) => training.id === id);
