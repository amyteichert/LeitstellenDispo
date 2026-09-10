export type TrainingCatalogEntry = {
  id: string;
  courseType: string;
  label: string;
  stationKinds: Array<'Rettungswache' | 'Feuerwache'>;
  qualification: string;
  cost: number;
  durationMinutes: number;
  maxParticipants: number;
  description: string;
};

export const TRAINING_CATALOG: Record<string, TrainingCatalogEntry> = {
  drehleiter: {
    id: 'drehleiter',
    courseType: 'Drehleiter',
    label: 'Drehleiter',
    stationKinds: ['Feuerwache'],
    qualification: 'drehleiter',
    cost: 18000,
    durationMinutes: 90,
    maxParticipants: 8,
    description: 'Schulung zur sicheren Nutzung einer Drehleiter und Einsatzkoordination.',
  },
  "first-responder": {
    id: 'first-responder',
    courseType: 'First Responder / Sanitätshelfer',
    label: 'First Responder / Sanitätshelfer',
    stationKinds: ['Rettungswache'],
    qualification: 'firstResponder',
    cost: 12000,
    durationMinutes: 75,
    maxParticipants: 10,
    description: 'Grundlagen der Erstversorgung und rettungsdienstlichen Unterstützung.',
  },
  abc: {
    id: 'abc',
    courseType: 'ABC / CSA',
    label: 'ABC / CSA',
    stationKinds: ['Feuerwache', 'Rettungswache'],
    qualification: 'abc',
    cost: 22000,
    durationMinutes: 120,
    maxParticipants: 8,
    description: 'Auffrischung der Chemie-, Biologie- und Strahlenschutzausbildung.',
  },
  gruppenfuehrer: {
    id: 'gruppenfuehrer',
    courseType: 'Gruppenführer',
    label: 'Gruppenführer',
    stationKinds: ['Feuerwache', 'Rettungswache'],
    qualification: 'gruppenfuehrer',
    cost: 24000,
    durationMinutes: 120,
    maxParticipants: 8,
    description: 'Führung von Einsatzkräften im Einsatz und in der Lagebewertung.',
  },
  zugfuehrer: {
    id: 'zugfuehrer',
    courseType: 'Zugführer',
    label: 'Zugführer',
    stationKinds: ['Feuerwache'],
    qualification: 'zugfuehrer',
    cost: 26000,
    durationMinutes: 150,
    maxParticipants: 6,
    description: 'Leitung und Organisation von Zug- und Gruppeneinsätzen.',
  },
  absturzsicherung: {
    id: 'absturzsicherung',
    courseType: 'Absturzsicherung',
    label: 'Absturzsicherung',
    stationKinds: ['Feuerwache'],
    qualification: 'absturzsicherung',
    cost: 17000,
    durationMinutes: 90,
    maxParticipants: 8,
    description: 'Sicherungsmaßnahmen und technische Absturzläufe für Höhen- und Spezialeinsätze.',
  },
  hohenretter: {
    id: 'hohenretter',
    courseType: 'Höhenretter',
    label: 'Höhenretter',
    stationKinds: ['Feuerwache'],
    qualification: 'hohenretter',
    cost: 24000,
    durationMinutes: 150,
    maxParticipants: 6,
    description: 'Technik und Regeln für Höhenrettung und Rettung aus Gefahrenlagen.',
  },
  bootsfuehrer: {
    id: 'bootsfuehrer',
    courseType: 'Bootsführer',
    label: 'Bootsführer',
    stationKinds: ['Feuerwache'],
    qualification: 'bootsfuehrer',
    cost: 20000,
    durationMinutes: 105,
    maxParticipants: 8,
    description: 'Bootsführung, Wasserrettung und Einsatzorganisation an Gewässern.',
  },
  taucher: {
    id: 'taucher',
    courseType: 'Taucher',
    label: 'Taucher',
    stationKinds: ['Feuerwache'],
    qualification: 'taucher',
    cost: 26000,
    durationMinutes: 180,
    maxParticipants: 5,
    description: 'Taucherausbildung mit Sicherheits- und Rettungsaspekten.',
  },
};

export const getTrainingDefinition = (courseType: string) =>
  Object.values(TRAINING_CATALOG).find((training) => training.id === courseType || training.courseType === courseType);

export const trainingCourseMatchesStation = (stationKind: 'Rettungswache' | 'Feuerwache' | undefined, courseType: string) => {
  const definition = getTrainingDefinition(courseType);
  return Boolean(definition && (!stationKind || definition.stationKinds.includes(stationKind)));
};
