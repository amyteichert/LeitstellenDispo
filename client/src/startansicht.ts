// Ansicht, mit der das Spiel startet – pro Gerät im Browser gemerkt (z. B. Karte am PC, Einsätze am Tablet)

export const ANSICHTEN = ['Karte', 'Wachen', 'Krankenhäuser', 'Fahrzeuge', 'Einsätze', 'Funk', 'Finanzen', 'Einstellungen', 'Team'] as const;
export type Ansicht = (typeof ANSICHTEN)[number];

/** Nur für Team-Rollen sichtbar */
export const TEAM_ANSICHTEN: readonly Ansicht[] = ['Team'];

/** Ansichten, die dieses Konto im Menü sieht */
export const sichtbareAnsichten = (team: boolean): readonly Ansicht[] =>
  ANSICHTEN.filter((ansicht) => team || !TEAM_ANSICHTEN.includes(ansicht));

/** Als Startansicht sinnvoll (Einstellungen und Team ausgenommen) */
export const STARTANSICHTEN: readonly Ansicht[] = ANSICHTEN.filter(
  (ansicht) => ansicht !== 'Einstellungen' && !TEAM_ANSICHTEN.includes(ansicht),
);

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
