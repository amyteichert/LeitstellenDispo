/**
 * Gezeichnete Standardgrafiken der Fahrzeuge: Seitenansicht (120×56), Front rechts.
 * Jede Grafik entsteht aus wenigen Merkmalen (Bauform, Farben, Zubehör) – so bleiben alle im selben Stil.
 * Die Texte stammen aus dieser Datei bzw. dem festen Fahrzeugkatalog, nie aus Nutzereingaben.
 * Die Lackfarbe kann der Spieler ändern (nur geprüfte #rrggbb-Werte) – Schrift und Streifen passen sich an.
 */
import { getSchriftFarbe, istHelleFarbe, istLogoFarbe } from '@leitstellendispo/shared';

type Bauform = 'lkw' | 'lkwKurz' | 'transporter' | 'bus' | 'pkw' | 'drehleiter' | 'kran' | 'hubschrauber';
type Zubehoer = 'boot' | 'mast' | 'warntafel' | 'schlauch' | 'seil';

interface Zeichnung {
  bauform: Bauform;
  /** Aufschrift auf dem Schild bzw. der Seite */
  aufschrift: string;
  farbe: string;
  streifen: string;
  zubehoer?: Zubehoer[];
}

const FW = { farbe: '#c62828', streifen: '#f5f5f5' };
const RD = { farbe: '#f8fafc', streifen: '#ea4b1d' };
const FUEHRUNG_RD = { farbe: '#f8fafc', streifen: '#facc15' };

const ZEICHNUNGEN: Record<string, Zeichnung> = {
  RTW: { bauform: 'transporter', aufschrift: 'RTW', ...RD },
  NEF: { bauform: 'pkw', aufschrift: 'NEF', ...RD },
  KTW: { bauform: 'bus', aufschrift: 'KTW', ...RD },
  ITW: { bauform: 'transporter', aufschrift: 'ITW', ...RD, streifen: '#b91c1c' },
  RTH: { bauform: 'hubschrauber', aufschrift: 'RTH', farbe: '#dc2626', streifen: '#f8fafc' },
  'KdoW-LNA': { bauform: 'pkw', aufschrift: 'LNA', ...FUEHRUNG_RD },
  'KdoW-OrgL': { bauform: 'pkw', aufschrift: 'OrgL', ...FUEHRUNG_RD },
  'GW-San': { bauform: 'lkwKurz', aufschrift: 'GW-San', farbe: '#f8fafc', streifen: '#dc2626' },
  'TSF-W': { bauform: 'lkwKurz', aufschrift: 'TSF-W', ...FW },
  MLF: { bauform: 'lkwKurz', aufschrift: 'MLF', ...FW },
  'LF 10': { bauform: 'lkw', aufschrift: 'LF 10', ...FW },
  'LF 20': { bauform: 'lkw', aufschrift: 'LF 20', ...FW },
  'HLF 10': { bauform: 'lkw', aufschrift: 'HLF 10', ...FW },
  'HLF 20': { bauform: 'lkw', aufschrift: 'HLF 20', ...FW, zubehoer: ['seil'] },
  'TLF 2000': { bauform: 'lkwKurz', aufschrift: 'TLF 2000', ...FW },
  'TLF 3000': { bauform: 'lkw', aufschrift: 'TLF 3000', ...FW },
  'TLF 4000': { bauform: 'lkw', aufschrift: 'TLF 4000', ...FW },
  'DLK 23/12': { bauform: 'drehleiter', aufschrift: 'DLK', ...FW },
  RW: { bauform: 'lkw', aufschrift: 'RW', ...FW, zubehoer: ['seil'] },
  'ELW 1': { bauform: 'bus', aufschrift: 'ELW 1', ...FW, zubehoer: ['mast'] },
  'ELW 2': { bauform: 'lkw', aufschrift: 'ELW 2', ...FW, zubehoer: ['mast'] },
  MTW: { bauform: 'bus', aufschrift: 'MTW', ...FW },
  'GW-A': { bauform: 'lkwKurz', aufschrift: 'GW-A', ...FW },
  'GW-Öl': { bauform: 'lkwKurz', aufschrift: 'GW-Öl', ...FW },
  'SW 2000': { bauform: 'lkw', aufschrift: 'SW 2000', ...FW, zubehoer: ['schlauch'] },
  'GW-L2': { bauform: 'lkw', aufschrift: 'GW-L2', ...FW },
  FwK: { bauform: 'kran', aufschrift: 'FwK', ...FW },
  'GW-G': { bauform: 'lkw', aufschrift: 'GW-G', ...FW, zubehoer: ['warntafel'] },
  'GW-Mess': { bauform: 'bus', aufschrift: 'GW-Mess', ...FW, zubehoer: ['mast'] },
  'GW-Wasserrettung': { bauform: 'lkwKurz', aufschrift: 'GW-W', ...FW, zubehoer: ['boot'] },
  'GW-Höhenrettung': { bauform: 'bus', aufschrift: 'GW-H', ...FW, zubehoer: ['seil'] },
};

const REIFEN = '#1f2937';
const FELGE = '#9ca3af';
const SCHEIBE = '#9cc4e4';
const BLAU = '#2563eb';
const DUNKEL = 'rgba(0,0,0,.14)';

const rad = (x: number, r = 6.5) => `<circle cx="${x}" cy="46.5" r="${r}" fill="${REIFEN}"/><circle cx="${x}" cy="46.5" r="${r * 0.45}" fill="${FELGE}"/>`;
const blaulicht = (x: number, y: number, breite: number) =>
  `<rect x="${x}" y="${y}" width="${breite}" height="3" rx="1" fill="${BLAU}"/><rect x="${x + 1}" y="${y + 0.6}" width="${breite / 3}" height="1.2" fill="#93c5fd"/>`;
const unterbau = (von: number, bis: number) => `<rect x="${von}" y="43" width="${bis - von}" height="3.5" fill="#374151"/>`;

/** Schild mit Aufschrift; Schriftgröße passt sich der Länge an */
function schild(x: number, y: number, breite: number, text: string, textFarbe: string, grund = '#fff') {
  const groesse = Math.min(8, (breite - 4) / (text.length * 0.62));
  return `<rect x="${x}" y="${y}" width="${breite}" height="10" rx="1.5" fill="${grund}"/>`
    + `<text x="${x + breite / 2}" y="${y + 5.2}" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="${groesse.toFixed(1)}" `
    + `text-anchor="middle" dominant-baseline="middle" fill="${textFarbe}">${text}</text>`;
}

/** Fahrerhaus eines LKW, Front rechts bei x=114 */
const fahrerhaus = (z: Zeichnung) =>
  `<path d="M84 44V14h20l9.5 12.5V44z" fill="${z.farbe}"/>`
  + `<path d="M88 17h14.5l7 9H88z" fill="${SCHEIBE}"/>`
  + `<path d="M98 28v14" stroke="${DUNKEL}" stroke-width="1"/>`
  + `<rect x="112" y="37" width="3" height="7" rx="1" fill="#374151"/>`
  + blaulicht(88, 10.8, 14);

/** Aufbau mit Rolltoren */
function aufbau(z: Zeichnung, von: number, bis: number, oben = 12) {
  const teile = [`<rect x="${von}" y="${oben}" width="${bis - von}" height="${44 - oben}" rx="2" fill="${z.farbe}"/>`];
  const felder = Math.max(2, Math.round((bis - von - 6) / 15));
  const breite = (bis - von - 6 - (felder - 1) * 2) / felder;
  for (let i = 0; i < felder; i += 1) {
    const x = von + 3 + i * (breite + 2);
    teile.push(`<rect x="${x.toFixed(1)}" y="${oben + 3}" width="${breite.toFixed(1)}" height="${31 - oben}" rx="1" fill="${DUNKEL}"/>`);
  }
  teile.push(blaulicht(von + 1, oben - 3, 5));
  return teile.join('');
}

const streifen = (z: Zeichnung, von: number, bis: number, y = 34) => `<rect x="${von}" y="${y}" width="${bis - von}" height="3" fill="${z.streifen}"/>`;

/** Seitenschild mit der Aufschrift – weiße Fahrzeuge: farbiges Schild, sonst weißes Schild in Lackfarbe (auf hellem Lack dunkel) */
const aufschrift = (z: Zeichnung, x: number, y: number, breite: number) =>
  z.farbe === '#f8fafc' ? schild(x, y, breite, z.aufschrift, '#fff', z.streifen)
    : schild(x, y, breite, z.aufschrift, istHelleFarbe(z.farbe) ? '#1f2937' : z.farbe);

function zubehoer(z: Zeichnung, aufbauVon: number): string {
  const teile: string[] = [];
  for (const teil of z.zubehoer ?? []) {
    if (teil === 'boot') teile.push(`<path d="M${aufbauVon + 4} 11l5-6h46l4 6z" fill="#f97316"/><path d="M${aufbauVon + 9} 5h46" stroke="#7c2d12" stroke-width="1"/>`);
    if (teil === 'mast') teile.push(`<path d="M${aufbauVon + 10} 12V1" stroke="#374151" stroke-width="1.6"/><circle cx="${aufbauVon + 10}" cy="1.5" r="1.4" fill="#374151"/>`);
    if (teil === 'warntafel') teile.push(`<rect x="104" y="37.5" width="7" height="5" fill="#f59e0b" stroke="#111" stroke-width=".6"/>`);
    if (teil === 'schlauch') teile.push(`<circle cx="${aufbauVon + 1}" cy="38" r="4" fill="#d1d5db" stroke="#6b7280" stroke-width="1"/>`);
    if (teil === 'seil') teile.push(`<circle cx="113" cy="40.5" r="1.8" fill="#6b7280"/>`);
  }
  return teile.join('');
}

function zeichne(z: Zeichnung): string {
  switch (z.bauform) {
    case 'lkw':
    case 'lkwKurz': {
      const von = z.bauform === 'lkw' ? 6 : 20;
      return unterbau(von, 114) + aufbau(z, von, 83) + fahrerhaus(z) + streifen(z, von, 113.5)
        + aufschrift(z, von + (83 - von) / 2 - 17, 19, 34) + zubehoer(z, von)
        + (z.bauform === 'lkw' ? rad(22) + rad(38) : rad(34)) + rad(100);
    }
    case 'drehleiter': {
      const sprossen = Array.from({ length: 19 }, (_, i) => `M${12 + i * 5} 6.5v5`).join('');
      return unterbau(8, 114) + `<rect x="8" y="22" width="76" height="22" rx="2" fill="${z.farbe}"/>`
        + `<rect x="66" y="14" width="14" height="9" rx="1.5" fill="#374151"/>`
        + fahrerhaus(z) + streifen(z, 8, 113.5)
        + `<path d="M10 6.5h96M10 11.5h96" stroke="#d1d5db" stroke-width="1.6"/><path d="${sprossen}" stroke="#d1d5db" stroke-width="1"/>`
        + `<rect x="104" y="3" width="11" height="9" rx="1" fill="none" stroke="#d1d5db" stroke-width="1.6"/>`
        + aufschrift(z, 24, 26, 30) + rad(24) + rad(100);
    }
    case 'kran': {
      return unterbau(4, 114) + `<rect x="4" y="26" width="80" height="18" rx="2" fill="${z.farbe}"/>`
        + `<rect x="58" y="16" width="16" height="11" rx="1.5" fill="#374151"/><rect x="61" y="18" width="8" height="5" fill="${SCHEIBE}"/>`
        + `<path d="M8 18L110 8l1 5L9 23z" fill="#facc15" stroke="#92400e" stroke-width=".8"/>`
        + `<path d="M110 13v7" stroke="#374151" stroke-width="1"/><path d="M108 20h4l-2 3z" fill="#374151"/>`
        + fahrerhaus(z) + streifen(z, 4, 113.5) + aufschrift(z, 18, 30, 28)
        + rad(16) + rad(30) + rad(86) + rad(100);
    }
    case 'transporter': {
      return unterbau(8, 112)
        + `<rect x="8" y="8" width="73" height="36" rx="2.5" fill="${z.farbe}" stroke="#cbd5e1" stroke-width=".6"/>`
        + `<rect x="58" y="13" width="15" height="9" rx="1" fill="#e2e8f0"/>`
        + `<path d="M80 44V16h16l11 11 5 3v14z" fill="${z.farbe}" stroke="#cbd5e1" stroke-width=".6"/>`
        + `<path d="M84 19h11l9 9H84z" fill="${SCHEIBE}"/>`
        + streifen(z, 8, 112, 31) + `<rect x="8" y="35" width="104" height="1.4" fill="#facc15"/>`
        + blaulicht(9, 5, 5) + blaulicht(74, 5, 6) + blaulicht(86, 13, 8)
        + `<text x="34" y="22" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="11" text-anchor="middle" dominant-baseline="middle" fill="${z.streifen}">${z.aufschrift}</text>`
        + rad(26) + rad(96);
    }
    case 'bus': {
      const hell = z.farbe === '#f8fafc';
      return unterbau(8, 112)
        + `<path d="M8 44V14q0-3 3-3h78l15 13 8 4v16z" fill="${z.farbe}" ${hell ? 'stroke="#cbd5e1" stroke-width=".6"' : ''}/>`
        + `<path d="M14 15h14v9H14zM31 15h14v9H31zM48 15h14v9H48zM65 15h14v9H65z" fill="${SCHEIBE}"/>`
        + `<path d="M83 15h6l12 10H83z" fill="${SCHEIBE}"/>`
        + streifen(z, 8, 112, 31) + blaulicht(14, 8, 6) + blaulicht(76, 8, 8)
        + aufschrift(z, 28, 33.5, 32) + zubehoer(z, 8) + rad(26) + rad(94);
    }
    case 'pkw': {
      return `<path d="M8 44V32l13-3 13-12h42l15 12 17 3q4 1 4 5v7z" fill="${z.farbe}" stroke="#cbd5e1" stroke-width=".6"/>`
        + `<path d="M37 20h18v9H28zM58 20h16l11 9H58z" fill="${SCHEIBE}"/>`
        + streifen(z, 8, 112, 33) + blaulicht(46, 13.5, 18)
        + `<text x="60" y="40.5" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="6.5" text-anchor="middle" dominant-baseline="middle" fill="${z.streifen === '#facc15' ? '#b91c1c' : z.streifen}">${z.aufschrift}</text>`
        + rad(28, 7) + rad(92, 7);
    }
    case 'hubschrauber': {
      return `<path d="M34 30L4 25v5l30 6z" fill="${z.farbe}"/><circle cx="7" cy="23" r="5" fill="none" stroke="#6b7280" stroke-width="1.2"/>`
        + `<path d="M32 34q0-16 22-18h24q18 2 22 16 0 8-12 10H44q-12 0-12-8z" fill="${z.farbe}"/>`
        + `<path d="M33 37q2 5 11 5h44q10 0 12-8z" fill="${z.streifen}"/>`
        + `<path d="M80 20h10q7 3 9 11H80z" fill="${SCHEIBE}"/>`
        + `<path d="M62 16v-5" stroke="#374151" stroke-width="3"/><path d="M14 10h96" stroke="#374151" stroke-width="2" stroke-linecap="round"/>`
        + `<path d="M46 42l-3 8M84 42l3 8M36 50h58" stroke="#374151" stroke-width="1.8" stroke-linecap="round" fill="none"/>`
        + `<text x="58" y="28" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="9" text-anchor="middle" dominant-baseline="middle" fill="${getSchriftFarbe(z.farbe)}">${z.aufschrift}</text>`;
    }
  }
}

const cache = new Map<string, string>();

/** Zeichnung mit eigener Lackfarbe: helle Streifen auf hellem Lack werden rot, damit sie sichtbar bleiben */
function umgefaerbt(z: Zeichnung, farbe: string): Zeichnung {
  const streifenSichtbar = istHelleFarbe(farbe) !== istHelleFarbe(z.streifen);
  return { ...z, farbe, streifen: streifenSichtbar ? z.streifen : istHelleFarbe(farbe) ? '#c62828' : '#f5f5f5' };
}

/** SVG-Text der Standardgrafik eines Fahrzeugtyps (unbekannte Typen: neutraler Transporter), optional in eigener Farbe */
export function standardGrafikSvg(typ: string | undefined, farbe?: string): string {
  const eigeneFarbe = istLogoFarbe(farbe) ? farbe.toLowerCase() : undefined;
  const schluessel = `${typ ?? ''}|${eigeneFarbe ?? ''}`;
  const vorhanden = cache.get(schluessel);
  if (vorhanden) return vorhanden;
  const basis = ZEICHNUNGEN[typ ?? ''] ?? { bauform: 'transporter', aufschrift: '?', ...RD };
  const zeichnung = eigeneFarbe ? umgefaerbt(basis, eigeneFarbe) : basis;
  const svg = `<svg viewBox="0 0 120 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${zeichne(zeichnung)}</svg>`;
  cache.set(schluessel, svg);
  return svg;
}

export const hatStandardGrafik = (typ: string) => typ in ZEICHNUNGEN;
