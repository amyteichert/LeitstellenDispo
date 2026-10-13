/**
 * Kleiner, deterministischer Zufallsgenerator (mulberry32) für Bot und Simulation.
 * Mit demselben Startwert (Seed) kommt derselbe Verlauf heraus – Fehler sind so reproduzierbar.
 */
export type Zufall = () => number;

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

export function zufallsZahl(zufall: Zufall, min: number, max: number): number {
  return min + Math.floor(zufall() * (max - min + 1));
}

export function zufallsElement<T>(zufall: Zufall, liste: readonly T[]): T | undefined {
  if (liste.length === 0) return undefined;
  return liste[Math.floor(zufall() * liste.length)];
}
