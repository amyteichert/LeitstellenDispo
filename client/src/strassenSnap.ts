import { haversineKm, mitWiederholung, type Koordinaten, type OsmAdressDetails } from '@leitstellendispo/shared';

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

/** OSRM nur kurz wiederholen: Die Adresse (Nominatim) soll nicht minutenlang auf das Einrasten warten. */
const OSRM_WARTEZEITEN_MS = [1_000, 3_000];

/** Lohnt sich ein neuer Versuch? (Dienst überlastet/gestört – nicht: Anfrage ungültig) */
const vorruebergehend = (status: number) => status === 429 || status === 408 || status >= 500;

/**
 * Ein Versuch beim OSRM-Server: Treffer, `null` (keine Straße in der Nähe) oder
 * `undefined` (Netz/Dienst gestört – nochmal versuchen).
 */
async function osrmNaechsteStrasse(coords: Koordinaten): Promise<StrassenTreffer | null | undefined> {
  const res = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${coords[1]},${coords[0]}?number=5`);
  if (!res.ok) return vorruebergehend(res.status) ? undefined : null;
  const { waypoints } = (await res.json()) as { waypoints?: OsrmWegpunkt[] };
  const punkt = waypoints?.[0];
  if (!punkt || punkt.distance > MAX_ABSTAND_M) return null;
  const ziel: Koordinaten = [punkt.location[1], punkt.location[0]];
  const strassen = (waypoints ?? [])
    .filter((wp) => wp.name && haversineKm(ziel, [wp.location[1], wp.location[0]]) <= KREUZUNG_ABSTAND_KM)
    .map((wp) => wp.name as string);
  return { coords: ziel, strassen };
}

/**
 * Verschiebt einen Einsatzort auf die nächste befahrbare Straße (OSRM, ohne Schlüssel)
 * und liefert die echten Straßennamen dort mit.
 * So landen Einsätze nicht im Wasser oder mitten im Wald und die Adresse passt zur Karte.
 * Ist der Dienst gestört, wird es kurz erneut versucht.
 * Klappt es gar nicht, bleibt der Punkt unverändert und es gibt keine Straßennamen.
 */
export async function aufStrasseSetzen(coords: Koordinaten): Promise<StrassenTreffer> {
  return (await mitWiederholung(() => osrmNaechsteStrasse(coords), OSRM_WARTEZEITEN_MS)) ?? { coords, strassen: [] };
}

/** Nominatim erlaubt höchstens 1 Anfrage pro Sekunde – etwas Luft dazu. */
const NOMINATIM_ABSTAND_MS = 1100;
let naechsteNominatimAnfrage = 0;

/** Wartet, bis die nächste Nominatim-Anfrage erlaubt ist (alle Aufrufe hintereinander, nie gleichzeitig). */
const nominatimFreigabe = async () => {
  const jetzt = Date.now();
  const start = Math.max(jetzt, naechsteNominatimAnfrage);
  naechsteNominatimAnfrage = start + NOMINATIM_ABSTAND_MS;
  if (start > jetzt) await new Promise((fertig) => setTimeout(fertig, start - jetzt));
};

/** Ein Versuch bei Nominatim: Adressdetails, `null` (keine Adresse hier) oder `undefined` (nochmal versuchen). */
async function nominatimRueckwaerts(coords: Koordinaten): Promise<OsmAdressDetails | null | undefined> {
  await nominatimFreigabe();
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords[0]}&lon=${coords[1]}`
    + '&addressdetails=1&zoom=18&layer=address&accept-language=de';
  const res = await fetch(url);
  if (!res.ok) return vorruebergehend(res.status) ? undefined : null;
  const data = (await res.json()) as { address?: OsmAdressDetails };
  return data?.address ?? null;
}

/**
 * Echte Adresse (Straße, Hausnummer, PLZ, Ort) zu einem Punkt aus OpenStreetMap (Nominatim-Rückwärtssuche).
 * Bei Störungen wird es mehrmals mit wachsender Pause erneut versucht.
 * Liefert die rohen Adressdetails, `null`, wenn es dort keine Adresse gibt, oder `undefined`, wenn alle Versuche scheiterten.
 */
export async function adresseZuPosition(coords: Koordinaten): Promise<OsmAdressDetails | null | undefined> {
  return mitWiederholung(() => nominatimRueckwaerts(coords));
}
