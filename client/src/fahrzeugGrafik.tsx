/**
 * Fahrzeugbilder: gewählte Grafik aus dem Katalog (hochgeladen) oder die gezeichnete Standardgrafik.
 * Die Auswahl des Spielers kommt über einen Kontext in die Listen; für Leaflet-HTML liegt sie zusätzlich im Modul.
 */
import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties } from 'react';
import {
  FAHRZEUGGRAFIK_BREITE,
  FAHRZEUGGRAFIK_HOEHE,
  FAHRZEUGGRAFIK_MAX_BYTES,
  getFahrzeugFarbe,
  getFahrzeugTyp,
  type Fahrzeuggrafik,
  type GrafikAuswahl,
  type MapLocation,
  type Vehicle,
} from '@leitstellendispo/shared';
import { standardGrafikSvg } from './fahrzeugZeichnung';

/** Seitenverhältnis der Grafiken (Breite : Höhe) */
export const GRAFIK_VERHAELTNIS = 120 / 56;

export const grafikUrl = (id: number) => `/api/fahrzeuggrafiken/${id}/bild`;

type WachenFarben = Array<Pick<MapLocation, 'id' | 'fahrzeugFarbe'>>;

/** Gewählte Grafiken je Typ und die Wachen (für deren Fahrzeugfarbe) */
export const GrafikKontext = createContext<{ auswahl: GrafikAuswahl; wachen: WachenFarben }>({ auswahl: {}, wachen: [] });

/** Was ein Fahrzeug für sein Bild mitbringt */
export type FahrzeugAussehen = Partial<Pick<Vehicle, 'type' | 'grafikId' | 'farbe' | 'stationId'>>;

// ---- Für Leaflet (HTML-Texte außerhalb von React) ----
let modulAuswahl: GrafikAuswahl = {};
let modulWachen: WachenFarben = [];
/** IDs, die es im Katalog (noch) gibt – null, solange der Katalog nicht geladen ist */
let bekannteIds: Set<number> | null = null;

export const setzeModulAuswahl = (auswahl: GrafikAuswahl, wachen: WachenFarben) => { modulAuswahl = auswahl; modulWachen = wachen; };

const gueltig = (id: number | undefined) => id !== undefined && (bekannteIds === null || bekannteIds.has(id));

/** Lackfarbe für Leaflet-Schilder (Fahrzeug, sonst Wache) – nur geprüfte #rrggbb-Werte */
export const fahrzeugFarbeModul = (fahrzeug: FahrzeugAussehen) => getFahrzeugFarbe(fahrzeug, modulWachen);

/** Kleines Fahrzeugbild als HTML für Leaflet-Schilder */
export function fahrzeugBildHtml(fahrzeug: FahrzeugAussehen): string {
  const id = fahrzeug.grafikId ?? (fahrzeug.type ? modulAuswahl[fahrzeug.type] : undefined);
  const inhalt = gueltig(id) ? `<img src="${grafikUrl(id!)}" alt="" draggable="false">` : standardGrafikSvg(fahrzeug.type, fahrzeugFarbeModul(fahrzeug));
  return `<i class="fahrzeug-bild fahrzeug-bild--karte">${inhalt}</i>`;
}

function Bild({ id, typ, farbe, stil, titel }: { id: number; typ?: string; farbe?: string; stil: CSSProperties; titel: string }) {
  const [kaputt, setKaputt] = useState(false);
  if (kaputt) return <StandardBild typ={typ} farbe={farbe} stil={stil} titel={titel} />;
  return <img className="fahrzeug-bild" style={stil} src={grafikUrl(id)} alt={titel} title={titel} loading="lazy" onError={() => setKaputt(true)} />;
}

function StandardBild({ typ, farbe, stil, titel }: { typ?: string; farbe?: string; stil: CSSProperties; titel: string }) {
  // Feste SVG-Texte aus fahrzeugZeichnung.ts – die Farbe wird dort auf #rrggbb geprüft
  return <span className="fahrzeug-bild" style={stil} role="img" aria-label={titel} title={titel} dangerouslySetInnerHTML={{ __html: standardGrafikSvg(typ, farbe) }} />;
}

/**
 * Bild eines Fahrzeugs in beliebiger Höhe. `fahrzeug` bringt eigene Grafik und Farbe mit (sonst Wahl für den Typ bzw. Wachenfarbe).
 * `grafikId` erzwingt eine Grafik (Vorschau im Katalog), `standard` die gezeichnete Grafik, `farbe` eine Lackfarbe.
 */
export function FahrzeugBild({ typ, fahrzeug, grafikId, farbe, hoehe = 24, standard = false }: {
  typ?: string;
  fahrzeug?: FahrzeugAussehen;
  grafikId?: number;
  farbe?: string;
  hoehe?: number;
  standard?: boolean;
}) {
  const { auswahl, wachen } = useContext(GrafikKontext);
  const fahrzeugTyp = typ ?? fahrzeug?.type;
  const id = standard ? undefined : grafikId ?? fahrzeug?.grafikId ?? (fahrzeugTyp ? auswahl[fahrzeugTyp] : undefined);
  const lack = farbe ?? (fahrzeug ? getFahrzeugFarbe(fahrzeug, wachen) : undefined);
  const stil = { width: Math.round(hoehe * GRAFIK_VERHAELTNIS), height: hoehe };
  const titel = getFahrzeugTyp(fahrzeugTyp)?.bezeichnung ?? fahrzeugTyp ?? 'Fahrzeug';
  return id === undefined
    ? <StandardBild typ={fahrzeugTyp} farbe={lack} stil={stil} titel={titel} />
    : <Bild key={id} id={id} typ={fahrzeugTyp} farbe={lack} stil={stil} titel={titel} />;
}

// ---- Katalog laden, hochladen, löschen ----

async function anfrage<T>(methode: string, pfad: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/fahrzeuggrafiken${pfad}`, {
      method: methode,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('Der Server ist nicht erreichbar.');
  }
  const daten = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(daten?.fehler ?? `Unerwarteter Fehler (${res.status}).`);
  return daten as T;
}

let geladen: Promise<Fahrzeuggrafik[]> | null = null;
const abonnenten = new Set<(liste: Fahrzeuggrafik[]) => void>();

function setzeListe(liste: Fahrzeuggrafik[]) {
  bekannteIds = new Set(liste.map((g) => g.id));
  geladen = Promise.resolve(liste);
  abonnenten.forEach((melde) => melde(liste));
}

/** Lädt den Katalog (einmal je Seitenaufruf, außer `neu`) */
export function ladeGrafiken(neu = false): Promise<Fahrzeuggrafik[]> {
  if (!geladen || neu) {
    geladen = anfrage<{ grafiken: Fahrzeuggrafik[] }>('GET', '').then((d) => {
      setzeListe(d.grafiken);
      return d.grafiken;
    });
    geladen.catch(() => { geladen = null; });
  }
  return geladen;
}

/** Katalog als Zustand; aktualisiert sich bei Hochladen und Löschen überall */
export function useFahrzeuggrafiken() {
  const [grafiken, setGrafiken] = useState<Fahrzeuggrafik[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    abonnenten.add(setGrafiken);
    ladeGrafiken().then(setGrafiken, (e: Error) => setFehler(e.message));
    return () => { abonnenten.delete(setGrafiken); };
  }, []);
  const hochladen = useCallback(async (name: string, fahrzeugTyp: string, daten: string) => {
    const { grafik } = await anfrage<{ grafik: Fahrzeuggrafik }>('POST', '', { name, fahrzeugTyp, daten });
    setzeListe([grafik, ...((await geladen) ?? [])]);
    return grafik;
  }, []);
  const loeschen = useCallback(async (id: number) => {
    await anfrage('DELETE', `/${id}`);
    setzeListe(((await geladen) ?? []).filter((g) => g.id !== id));
  }, []);
  return { grafiken, fehler, hochladen, loeschen };
}

/**
 * Verkleinert ein gewähltes Bild auf höchstens 480×240 (Seitenverhältnis bleibt, Rest transparent)
 * und gibt es als Base64-WebP zurück (PNG, falls der Browser kein WebP kann).
 */
export async function bereiteFahrzeuggrafikVor(datei: File): Promise<string> {
  const bild = await createImageBitmap(datei);
  const faktor = Math.min(1, FAHRZEUGGRAFIK_BREITE / bild.width, FAHRZEUGGRAFIK_HOEHE / bild.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bild.width * faktor));
  canvas.height = Math.max(1, Math.round(bild.height * faktor));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Das Bild konnte nicht verarbeitet werden.');
  ctx.drawImage(bild, 0, 0, canvas.width, canvas.height);
  bild.close();
  const versuche: Array<[string, number | undefined]> = [['image/webp', 0.9], ['image/webp', 0.75], ['image/png', undefined], ['image/webp', 0.55]];
  for (const [format, qualitaet] of versuche) {
    const blob = await new Promise<Blob | null>((fertig) => canvas.toBlob(fertig, format, qualitaet));
    // Manche Browser liefern statt WebP stillschweigend PNG – das ist auch in Ordnung
    if (blob && blob.size <= FAHRZEUGGRAFIK_MAX_BYTES) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binaer = '';
      bytes.forEach((b) => { binaer += String.fromCharCode(b); });
      return btoa(binaer);
    }
  }
  throw new Error('Das Bild ist zu groß.');
}
