/**
 * Einfache Begrenzung von Fehlversuchen pro Schlüssel (z. B. IP-Adresse) in einem Zeitfenster.
 * Liegt nur im Arbeitsspeicher – reicht für einen einzelnen Server-Prozess.
 */
export function erstelleFehlversuchBremse(optionen: { maxVersuche: number; fensterMs: number }) {
  const versuche = new Map<string, { anzahl: number; zuruecksetzenUm: number }>();

  function aufraeumen(jetzt: number) {
    for (const [schluessel, eintrag] of versuche) {
      if (eintrag.zuruecksetzenUm <= jetzt) versuche.delete(schluessel);
    }
  }

  return {
    /** Sekunden bis zum nächsten erlaubten Versuch, oder 0, wenn der Schlüssel nicht gesperrt ist. */
    gesperrtFuer(schluessel: string, jetzt = Date.now()): number {
      const eintrag = versuche.get(schluessel);
      if (!eintrag || eintrag.zuruecksetzenUm <= jetzt || eintrag.anzahl < optionen.maxVersuche) return 0;
      return Math.ceil((eintrag.zuruecksetzenUm - jetzt) / 1000);
    },

    merkeFehlversuch(schluessel: string, jetzt = Date.now()): void {
      if (versuche.size > 10_000) aufraeumen(jetzt);
      const eintrag = versuche.get(schluessel);
      if (!eintrag || eintrag.zuruecksetzenUm <= jetzt) {
        versuche.set(schluessel, { anzahl: 1, zuruecksetzenUm: jetzt + optionen.fensterMs });
      } else {
        eintrag.anzahl++;
      }
    },

    zuruecksetzen(schluessel: string): void {
      versuche.delete(schluessel);
    },
  };
}

export type FehlversuchBremse = ReturnType<typeof erstelleFehlversuchBremse>;
