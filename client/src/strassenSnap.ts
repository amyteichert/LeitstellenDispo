import type { Koordinaten } from '@leitstellendispo/shared';

/** Weiter entfernte Straßen gelten nicht: dann bleibt der ursprüngliche Punkt. */
const MAX_ABSTAND_M = 1500;

/**
 * Verschiebt einen Einsatzort auf die nächste befahrbare Straße (OSRM, ohne Schlüssel).
 * So landen Einsätze nicht im Wasser oder mitten im Wald. Bei Fehlern bleibt der Punkt unverändert.
 */
export async function aufStrasseSetzen(coords: Koordinaten): Promise<Koordinaten> {
  try {
    const res = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${coords[1]},${coords[0]}?number=1`);
    if (!res.ok) return coords;
    const { waypoints } = (await res.json()) as { waypoints?: { location: [number, number]; distance: number }[] };
    const punkt = waypoints?.[0];
    if (!punkt || punkt.distance > MAX_ABSTAND_M) return coords;
    return [punkt.location[1], punkt.location[0]];
  } catch {
    return coords;
  }
}
