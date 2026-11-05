/**
 * Symbole für Wachen, Krankenhäuser, Fahrzeuge und Einsätze – auf der Karte und in den Listen gleich.
 * Die Grafiken sind feste SVG-Texte (24×24, weiße Linien auf farbigem Grund) oder Bilder aus public/symbole
 * (Flaticon – Bildnachweis im Impressum). Leaflet bekommt sie als HTML, React-Listen zeigen sie über <Kennzeichen …/>.
 */
import { FahrzeugBild, fahrzeugBildHtml, type FahrzeugAussehen } from './fahrzeugGrafik';
import {
  getEinsatzSymbol, getSchriftFarbe, istLogoFarbe, istLogoSymbol, type EinsatzSymbol, type SpielEinsatz, type StationKind, type WachenLogoSymbol,
} from '@leitstellendispo/shared';

const LINIE = 'fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const svg = (inhalt: string) => `<svg viewBox="0 0 24 24" width="100%" height="100%" ${LINIE} aria-hidden="true">${inhalt}</svg>`;
/** Bild aus public/symbole; `weiss` färbt schwarze Linien-Symbole weiß (passend zu den farbigen Kästchen) */
const bild = (datei: string, weiss = false) =>
  `<img src="/symbole/${datei}.png" alt="" draggable="false" class="kennzeichen__bild${weiss ? ' kennzeichen__bild--weiss' : ''}">`;

// Bausteine für das Verkehrsunfall-Symbol
const RAEDER = '<circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>';
const PKW = '<path d="M3.5 16.5v-3l2-4h11l2.5 4v3"/><path d="M3.5 13.5h17M8.6 17.5h6.8"/>';

export const EINSATZ_GRAFIK: Record<EinsatzSymbol, string> = {
  brand: svg('<path d="M12 3c.8 2.8 5 4.8 5 10a5 5 0 0 1-10 0c0-2.6 1.4-3.8 2-5.2.6 1.6 1.4 2.2 2 2.2-.3-2.9.2-5.1 1-7z"/>'),
  alarm: svg('<path d="M6 16.5h12l-1.6-2.2V10a4.4 4.4 0 0 0-8.8 0v4.3z"/><path d="M10.4 19.2a1.7 1.7 0 0 0 3.2 0M4 6.5l1.5 1M20 6.5l-1.5 1"/>'),
  patient: svg('<circle cx="12" cy="5.5" r="2.2"/><path d="M12 8.5v6.5M7.5 11h9M12 15l-3 5M12 15l3 5"/>'),
  herz: svg('<path d="M12 19.5s-7.5-4.5-7.5-9.6A4 4 0 0 1 12 7.6a4 4 0 0 1 7.5 2.3c0 5.1-7.5 9.6-7.5 9.6z"/><path d="M7.5 12.5h2.5l1-2 2 4 1-2h2.5"/>'),
  verkehrsunfall: svg(`${PKW}${RAEDER}<path d="M4 3.5l2 2.5M8.5 2.5l.6 3M13 3.5l-1.2 2.3"/>`),
  technik: svg('<path d="M14.8 4.3a4.2 4.2 0 0 0-5 5.4L4 15.5 7.5 19l5.8-5.8a4.2 4.2 0 0 0 5.4-5l-2.6 2.6-2.6-.4-.4-2.6z"/>'),
  baum: svg('<path d="M12 3l5 6.5h-2.8l3.8 5H6l3.8-5H7z"/><path d="M12 14.5V21"/>'),
  wasser: svg('<path d="M12 3.5s5.8 6.6 5.8 10.6a5.8 5.8 0 0 1-11.6 0C6.2 10.1 12 3.5 12 3.5z"/><path d="M9.3 14.5a2.8 2.8 0 0 0 2.4 2.6"/>'),
  tier: svg('<circle cx="7.5" cy="10" r="1.6"/><circle cx="16.5" cy="10" r="1.6"/><circle cx="10.2" cy="6.3" r="1.6"/><circle cx="13.8" cy="6.3" r="1.6"/><path d="M8.6 17c0-2.8 1.6-4.6 3.4-4.6s3.4 1.8 3.4 4.6c0 2-1.6 2.6-3.4 2.6S8.6 19 8.6 17z"/>'),
  tuer: svg('<path d="M6.5 21V3.5h11V21M4 21h16"/><circle cx="14.6" cy="12.5" r=".9" fill="#fff"/>'),
  krankentransport: svg('<path d="M3 7.5V19M3 15h18V19M3 12.5h7.5a2.5 2.5 0 0 1 2.5 2.5"/><circle cx="6.5" cy="10.5" r="1.7"/>'),
};


const WACHE_GRAFIK: Record<StationKind, string> = {
  Feuerwache: bild('feuerwache'),
  Rettungswache: bild('rettungswache'),
};
const KRANKENHAUS_GRAFIK = bild('krankenhaus');

/**
 * Wählbare Logo-Symbole: Linien dunkel auf hellem, weiß auf dunklem Logo-Grund,
 * Herz und Blaulicht immer in ihrer eigenen Farbe.
 */
const LOGO_SYMBOL_GRAFIK: Record<Exclude<WachenLogoSymbol, 'standard'>, string> = {
  leiter: '<path d="M8 3v18M16 3v18M8 6.5h8M8 10.5h8M8 14.5h8M8 18.5h8"/>',
  flamme: '<path d="M12 3c.8 2.8 5 4.8 5 10a5 5 0 0 1-10 0c0-2.6 1.4-3.8 2-5.2.6 1.6 1.4 2.2 2 2.2-.3-2.9.2-5.1 1-7z" fill="#f97316" stroke="#c2410c"/>',
  helm: '<path d="M4.5 16.5a7.5 7.5 0 0 1 15 0z"/><path d="M2.5 16.5h19M12 9v7.5M8.5 10.5l1.2 6M15.5 10.5l-1.2 6"/>',
  herz: '<path d="M12 20s-8-4.8-8-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 8 2.4C20 15.2 12 20 12 20z" fill="#e53935" stroke="#b71c1c"/>',
  lebensstern: `<g fill="#1e66d0" stroke="none"><rect x="10" y="2.5" width="4" height="19" rx=".6"/><rect x="10" y="2.5" width="4" height="19" rx=".6" transform="rotate(60 12 12)"/><rect x="10" y="2.5" width="4" height="19" rx=".6" transform="rotate(-60 12 12)"/></g><path d="M12 6.5v11" stroke="#fff" stroke-width="1.3"/><path d="M10.6 9c1.8.4 1.8 1.6 1.4 2.2-.4.6-1.4 1-1.4 1.8s1 1.2 1.4 1.4" stroke="#fff" stroke-width="1"/>`,
  koffer: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5h6v2M12 10.5v6M9 13.5h6"/>',
  blaulicht: '<path d="M7 17.5v-5.5a5 5 0 0 1 10 0v5.5z" fill="#2f6fde" stroke="#1d4ed8"/><path d="M5 17.5h14M12 2.5v2.2M4.5 6l1.6 1.4M19.5 6l-1.6 1.4"/>',
};

/** Grafik im Wachen-Logo: gewähltes Symbol oder das Bild der Wachenart (unbekannte Werte → Standard, landet im HTML) */
const wachenGrafik = (art: StationKind | undefined, logoSymbol: string | undefined, grund: string) => {
  if (!istLogoSymbol(logoSymbol) || logoSymbol === 'standard') return WACHE_GRAFIK[art ?? 'Rettungswache'];
  const linie = getSchriftFarbe(grund);
  return `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${linie}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LOGO_SYMBOL_GRAFIK[logoSymbol]}</svg>`;
};

/** Wachen und Krankenhäuser: bunte Symbole auf hellem Kästchen (Gebäude), Fahrzeuge weiß auf Organisationsfarbe */
const HELL = '#f4f6f8';

/** Farben der Organisationen: Feuerwehr rot, Rettungsdienst orange */
export const ORGANISATION_FARBE = { fw: '#c62828', rd: '#d4570f' } as const;


/** Innenabstand zur Grafik: fest in Pixeln (Prozent-Padding würde sich auf das Elternelement beziehen) */
const abstand = (groesse: number) => Math.round(groesse * 0.16);
const kastenStil = (groesse: number, farbe: string) =>
  `width:${groesse}px;height:${groesse}px;padding:${abstand(groesse)}px;background:${farbe}`;

/** Hintergrund des Wachen-Logos: eigene Farbe des Spielers, sonst hell (nur gültige #rrggbb, landet im HTML) */
const wachenFarbe = (logoFarbe: string | undefined) => (istLogoFarbe(logoFarbe) ? logoFarbe : HELL);

/** HTML für Leaflet: Wache als farbiges Quadrat mit Symbol */
export const wachenMarkerHtml = (art: StationKind | undefined, groesse = 28, logoFarbe?: string, logoSymbol?: string) => {
  const grund = wachenFarbe(logoFarbe);
  return `<span class="kennzeichen kennzeichen--wache" style="${kastenStil(groesse, grund)}">${wachenGrafik(art, logoSymbol, grund)}</span>`;
};

export const krankenhausMarkerHtml = (groesse = 26) =>
  `<span class="kennzeichen kennzeichen--wache" style="${kastenStil(groesse, HELL)}">${KRANKENHAUS_GRAFIK}</span>`;

/** HTML für Leaflet: Einsatz-Symbol auf Statusfarbe (Form: Feuerwehr eckig, Rettungsdienst rund – macht das CSS) */
export const einsatzMarkerHtml = (einsatz: Pick<SpielEinsatz, 'stichwort' | 'meldebild'>, farbe: string, groesse: number) =>
  `<span class="kennzeichen kennzeichen--einsatz" style="${kastenStil(groesse, farbe)}">${EINSATZ_GRAFIK[getEinsatzSymbol(einsatz)]}</span>`;

/** Kleines Fahrzeugbild vor einem Text (für Fahrzeug-Schilder auf der Karte) – gewählte Grafik oder Standard */
export const fahrzeugSymbolHtml = (fahrzeug: FahrzeugAussehen) => fahrzeugBildHtml(fahrzeug);

type KennzeichenProps =
  | { art: 'wache'; wachenArt: StationKind | undefined; logoFarbe?: string; logoSymbol?: string }
  | { art: 'krankenhaus' }
  | { art: 'fahrzeug'; typ: string | undefined; fahrzeug?: FahrzeugAussehen }
  | { art: 'einsatz'; einsatz: Pick<SpielEinsatz, 'stichwort' | 'meldebild' | 'organization'> };

/** Symbol für Listen (Wachen, Fahrzeuge, Einsätze, Krankenhäuser) – gleiche Grafik wie auf der Karte */
export function Kennzeichen(props: KennzeichenProps & { groesse?: number }) {
  const groesse = props.groesse ?? 30;
  // Fahrzeuge zeigen ihr Bild (Seitenansicht) statt eines Symbols im Kästchen
  if (props.art === 'fahrzeug') return <FahrzeugBild typ={props.typ} fahrzeug={props.fahrzeug} hoehe={groesse} />;
  let grafik: string;
  let farbe: string;
  let rund = false;
  let titel: string;
  if (props.art === 'wache') {
    farbe = wachenFarbe(props.logoFarbe);
    grafik = wachenGrafik(props.wachenArt, props.logoSymbol, farbe);
    titel = props.wachenArt ?? 'Rettungswache';
  } else if (props.art === 'krankenhaus') {
    grafik = KRANKENHAUS_GRAFIK;
    farbe = HELL;
    titel = 'Krankenhaus';
  } else {
    grafik = EINSATZ_GRAFIK[getEinsatzSymbol(props.einsatz)];
    farbe = props.einsatz.organization === 'Feuerwehr' ? ORGANISATION_FARBE.fw : ORGANISATION_FARBE.rd;
    rund = props.einsatz.organization !== 'Feuerwehr';
    titel = props.einsatz.meldebild;
  }
  return (
    <span
      className={`kennzeichen ${rund ? 'kennzeichen--rund' : ''}`}
      style={{ width: groesse, height: groesse, padding: abstand(groesse), background: farbe }}
      title={titel}
      role="img"
      aria-label={titel}
      // Feste SVG-/Bild-Texte aus dieser Datei – keine Nutzereingaben
      dangerouslySetInnerHTML={{ __html: grafik }}
    />
  );
}
