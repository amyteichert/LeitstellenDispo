/**
 * Kleiner, deterministischer Zufallsgenerator (mulberry32).
 *
 * Wird vor allem vom Bot und der Simulation genutzt: Mit demselben Startwert (Seed)
 * kommt derselbe Spielverlauf heraus. Das macht Fehler reproduzierbar – man kann einen
 * Lauf, der etwas kaputt gemacht hat, exakt wiederholen.
 *
 * Für das normale Spiel bleibt `Math.random` der Standard.
 */
export type Zufall = () => number;

/** Erzeugt einen deterministischen Zufallsgenerator aus einem Startwert. */
export function erzeugeZufall(seed: number): Zufall {
  let zustand = seed >>> 0;
  return () => {
    zustand |= 0;
    zustand = (zustand + 0x6d2b79f5) | 0;
    let t = Math.imul(zustand ^ (zustand >>> 15), 1 | zustand);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ganzzahl im Bereich [min, max] (beide inklusive) mit dem gegebenen Generator. */
export function zufallsZahl(zufall: Zufall, min: number, max: number): number {
  return min + Math.floor(zufall() * (max - min + 1));
}

/** Zufälliges Element einer Liste (oder undefined bei leerer Liste). */
export function zufallsElement<T>(zufall: Zufall, liste: readonly T[]): T | undefined {
  if (liste.length === 0) return undefined;
  return liste[Math.floor(zufall() * liste.length)];
}
