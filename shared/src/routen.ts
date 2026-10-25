// Straßen-Routen (vom OSRM-Server über /api/routen). Die Spiellogik bleibt synchron:
// Sie schaut nur in diesen Speicher. Fehlt eine Route, merkt sie sich das Paar, der Client lädt sie nach,
// und bis dahin gilt die Luftlinie mit Umwegfaktor.
import type { Koordinaten } from './typen.js';

export interface Route {
  /** Fahrzeit laut Navi unter optimalen Bedingungen */
  dauerSekunden: number;
  distanzKm: number;
  /** Straßenverlauf vom Start zum Ziel */
  punkte: Koordinaten[];
}

export interface RoutenAnfrage {
  von: Koordinaten;
  nach: Koordinaten;
}

/** Wie viele Routen höchstens im Speicher bleiben (die ältesten fallen raus) */
const MAX_ROUTEN = 2000;

const routen = new Map<string, Route | null>();
const fehlend = new Map<string, RoutenAnfrage>();

const runde = (wert: number) => wert.toFixed(5);
export const routenSchluessel = (von: Koordinaten, nach: Koordinaten) =>
  `${runde(von[0])},${runde(von[1])};${runde(nach[0])},${runde(nach[1])}`;

/** Route aus dem Speicher – oder null (dann wird sie zum Nachladen vorgemerkt). */
export function getRoute(von: Koordinaten, nach: Koordinaten): Route | null {
  const schluessel = routenSchluessel(von, nach);
  const route = routen.get(schluessel);
  if (route === undefined) fehlend.set(schluessel, { von, nach });
  return route ?? null;
}

/** Merkt Routen zum Nachladen vor, ohne sie zu lesen (z. B. Wache → neuer Einsatz). */
export function merkeRoutenVor(anfragen: RoutenAnfrage[]) {
  for (const anfrage of anfragen) getRoute(anfrage.von, anfrage.nach);
}

/** Vom Client nachgeladen. `null` = keine Straßenroute gefunden, nicht erneut fragen. */
export function speichereRoute(anfrage: RoutenAnfrage, route: Route | null) {
  const schluessel = routenSchluessel(anfrage.von, anfrage.nach);
  fehlend.delete(schluessel);
  routen.delete(schluessel);
  routen.set(schluessel, route);
  if (routen.size > MAX_ROUTEN) routen.delete(routen.keys().next().value!);
}

/** Holt die vorgemerkten Paare ab (und leert die Liste). */
export function nimmFehlendeRouten(max = 50): RoutenAnfrage[] {
  const liste = [...fehlend.entries()].slice(0, max);
  for (const [schluessel] of liste) fehlend.delete(schluessel);
  return liste.map(([, anfrage]) => anfrage);
}

/** Nur für Tests */
export function leereRoutenSpeicher() {
  routen.clear();
  fehlend.clear();
}

const abstand = (a: Koordinaten, b: Koordinaten) => {
  // Für die Verteilung entlang der Linie reicht eine flache Näherung
  const dLat = a[0] - b[0];
  const dLng = (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

/** Punkt bei `anteil` (0–1) der Strecke entlang einer Linie. */
export function punktAufLinie(punkte: Koordinaten[], anteil: number): Koordinaten {
  if (punkte.length === 0) return [0, 0];
  if (punkte.length === 1 || anteil <= 0) return punkte[0];
  if (anteil >= 1) return punkte[punkte.length - 1];
  const stuecke = punkte.slice(1).map((punkt, i) => abstand(punkte[i], punkt));
  let rest = stuecke.reduce((summe, laenge) => summe + laenge, 0) * anteil;
  for (let i = 0; i < stuecke.length; i++) {
    if (rest <= stuecke[i]) {
      const t = stuecke[i] === 0 ? 0 : rest / stuecke[i];
      const [a, b] = [punkte[i], punkte[i + 1]];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    rest -= stuecke[i];
  }
  return punkte[punkte.length - 1];
}

/** Restlicher Straßenverlauf ab `anteil` – für die Linie auf der Karte. */
export function restLinie(punkte: Koordinaten[], anteil: number): Koordinaten[] {
  if (punkte.length < 2) return punkte;
  const position = punktAufLinie(punkte, anteil);
  const stuecke = punkte.slice(1).map((punkt, i) => abstand(punkte[i], punkt));
  let rest = stuecke.reduce((summe, laenge) => summe + laenge, 0) * Math.min(Math.max(anteil, 0), 1);
  let i = 0;
  while (i < stuecke.length && rest > stuecke[i]) rest -= stuecke[i++];
  return [position, ...punkte.slice(i + 1)];
}
