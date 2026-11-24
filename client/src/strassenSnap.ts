import { haversineKm, type Koordinaten } from '@leitstellendispo/shared';

/** Weiter entfernte Straßen gelten nicht: dann bleibt der ursprüngliche Punkt. */
const MAX_ABSTAND_M = 1500;
/** Bis zu diesem Abstand zur ersten Straße zählt eine zweite Straße als „Ecke“ (Kreuzung). */
const KREUZUNG_ABSTAND_KM = 0.08;

export interface StrassenTreffer {
  coords: Koordinaten;
  /** Echte Straßennamen am Punkt, nächste zuerst (leer, wenn OSRM keinen Namen kennt) */
  strassen: string[];
}

interface OsrmWegpunkt {
  location: [number, number];
  distance: number;
  name?: string;
}

/**
 * Verschiebt einen Einsatzort auf die nächste befahrbare Straße (OSRM, ohne Schlüssel)
 * und liefert die echten Straßennamen dort mit.
 * So landen Einsätze nicht im Wasser oder mitten im Wald und die Adresse passt zur Karte.
 * Bei Fehlern bleibt der Punkt unverändert und es gibt keine Straßennamen.
 */
export async function aufStrasseSetzen(coords: Koordinaten): Promise<StrassenTreffer> {
  const ohneTreffer = { coords, strassen: [] };
  try {
    const res = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${coords[1]},${coords[0]}?number=5`);
    if (!res.ok) return ohneTreffer;
    const { waypoints } = (await res.json()) as { waypoints?: OsrmWegpunkt[] };
    const punkt = waypoints?.[0];
    if (!punkt || punkt.distance > MAX_ABSTAND_M) return ohneTreffer;
    const ziel: Koordinaten = [punkt.location[1], punkt.location[0]];
    const strassen = (waypoints ?? [])
      .filter((wp) => wp.name && haversineKm(ziel, [wp.location[1], wp.location[0]]) <= KREUZUNG_ABSTAND_KM)
      .map((wp) => wp.name as string);
    return { coords: ziel, strassen };
  } catch {
    return ohneTreffer;
  }
}
