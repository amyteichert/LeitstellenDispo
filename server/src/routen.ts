// Straßen-Routen für die Fahrzeuge: fragt den eigenen OSRM-Server (OSRM_URL) und merkt sich die Antworten.
import { Router } from 'express';
import type { Koordinaten, Route, RoutenAnfrage } from '@leitstellendispo/shared';
import { routenSchluessel } from '@leitstellendispo/shared';

/** Höchstens so viele Routen pro Anfrage */
export const MAX_ROUTEN_PRO_ANFRAGE = 50;
const MAX_IM_SPEICHER = 20_000;
const ZEITLIMIT_MS = 5000;

const istKoordinate = (wert: unknown): wert is Koordinaten =>
  Array.isArray(wert) && wert.length === 2 && wert.every(Number.isFinite)
  && Math.abs(wert[0]) <= 90 && Math.abs(wert[1]) <= 180;

const runde = (wert: number) => Math.round(wert * 1e5) / 1e5;

export function erstelleRoutenRouter(osrmUrl: string | undefined): Router {
  const router = Router();
  const speicher = new Map<string, Route | null>();

  async function frageOsrm({ von, nach }: RoutenAnfrage): Promise<Route | null> {
    const schluessel = routenSchluessel(von, nach);
    if (speicher.has(schluessel)) return speicher.get(schluessel)!;
    // Ohne Fähren, sonst fahren Fahrzeuge übers Wasser
    const res = await fetch(
      `${osrmUrl}/route/v1/driving/${von[1]},${von[0]};${nach[1]},${nach[0]}?overview=full&geometries=geojson&exclude=ferry`,
      { signal: AbortSignal.timeout(ZEITLIMIT_MS) },
    );
    if (!res.ok && res.status !== 400) throw new Error(`OSRM antwortet mit ${res.status}`);
    const daten = await res.json() as { code: string; routes?: { duration: number; distance: number; geometry: { coordinates: [number, number][] } }[] };
    const treffer = daten.code === 'Ok' ? daten.routes?.[0] : undefined;
    // Keine Straße gefunden (z. B. Insel ohne Brücke): null merken, dann gilt im Spiel die Luftlinie
    const route: Route | null = treffer
      ? {
          dauerSekunden: Math.round(treffer.duration),
          distanzKm: Math.round(treffer.distance) / 1000,
          punkte: treffer.geometry.coordinates.map(([lng, lat]) => [runde(lat), runde(lng)]),
        }
      : null;
    speicher.set(schluessel, route);
    if (speicher.size > MAX_IM_SPEICHER) speicher.delete(speicher.keys().next().value!);
    return route;
  }

  router.post('/', async (req, res) => {
    if (!osrmUrl) return res.status(503).json({ fehler: 'Straßen-Routing ist nicht eingerichtet.' });
    const anfragen: unknown = req.body?.anfragen;
    if (!Array.isArray(anfragen) || anfragen.length > MAX_ROUTEN_PRO_ANFRAGE
      || !anfragen.every((a) => istKoordinate(a?.von) && istKoordinate(a?.nach))) {
      return res.status(400).json({ fehler: 'Ungültige Anfrage.' });
    }
    try {
      const routen = [];
      // Nacheinander, damit der OSRM-Server nicht mit vielen gleichzeitigen Anfragen überrollt wird
      for (const anfrage of anfragen as RoutenAnfrage[]) routen.push(await frageOsrm(anfrage));
      res.json({ routen });
    } catch (err) {
      console.error('Routing:', err);
      res.status(502).json({ fehler: 'Der Routing-Server ist nicht erreichbar.' });
    }
  });

  return router;
}
