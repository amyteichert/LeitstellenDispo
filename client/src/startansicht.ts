// Ansicht, mit der das Spiel startet – pro Gerät im Browser gemerkt (z. B. Karte am PC, Einsätze am Tablet)

export const ANSICHTEN = ['Karte', 'Wachen', 'Fahrzeuge', 'Einsätze', 'Funk', 'Finanzen', 'Einstellungen'] as const;
export type Ansicht = (typeof ANSICHTEN)[number];

/** Als Startansicht sinnvoll (Einstellungen ausgenommen) */
export const STARTANSICHTEN: readonly Ansicht[] = ANSICHTEN.filter((ansicht) => ansicht !== 'Einstellungen');

const STARTANSICHT_KEY = 'leitstellendispo.startansicht';

export function ladeStartansicht(): Ansicht {
  try {
    const gespeichert = localStorage.getItem(STARTANSICHT_KEY);
    return STARTANSICHTEN.find((ansicht) => ansicht === gespeichert) ?? 'Karte';
  } catch {
    return 'Karte';
  }
}

export function speichereStartansicht(ansicht: Ansicht): void {
  try {
    localStorage.setItem(STARTANSICHT_KEY, ansicht);
  } catch {
    // Ohne Browser-Speicher startet das Spiel einfach mit der Karte
  }
}
