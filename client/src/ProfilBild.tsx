import { PROFILBILD_GROESSE, PROFILBILD_MAX_BYTES, anzeigeName, type AvatarVorlage, type Konto } from '@leitstellendispo/shared';

/**
 * Profilbilder: gezeichnete Figuren (SVG aus Bausteinen), hochgeladene Bilder oder der Anfangsbuchstabe.
 * Die Figuren entstehen aus wenigen Merkmalen – so bleiben sie im selben Stil.
 */

type Frisur = 'kurz' | 'lang' | 'zopf' | 'keine' | 'locken';
type Kopf = 'helm' | 'kappe' | 'headset' | 'atemschutz' | 'keiner';

interface Figur {
  name: string;
  hintergrund: string;
  haut: string;
  haare: string;
  frisur: Frisur;
  kopf: Kopf;
  /** Farbe von Helm/Kappe/Headset */
  kopfFarbe?: string;
  kleidung: string;
  /** Reflexstreifen auf der Jacke */
  streifen?: string;
  brille?: boolean;
  bart?: boolean;
}

const HAUT = { hell: '#f5d0b0', mittel: '#d9a273', dunkel: '#8d5a3b', sehrDunkel: '#5e3a26' };

export const AVATAR_FIGUREN: Record<AvatarVorlage, Figur> = {
  'fw-helm': { name: 'Feuerwehr', hintergrund: '#7f1d1d', haut: HAUT.hell, haare: '#3b2a1a', frisur: 'keine', kopf: 'helm', kopfFarbe: '#e9d23a', kleidung: '#1f2a44', streifen: '#e9d23a' },
  'fw-helm-2': { name: 'Zugführerin', hintergrund: '#991b1b', haut: HAUT.dunkel, haare: '#1b1b1b', frisur: 'lang', kopf: 'helm', kopfFarbe: '#f1f1f1', kleidung: '#1f2a44', streifen: '#e9d23a' },
  'fw-maschinist': { name: 'Maschinist', hintergrund: '#b91c1c', haut: HAUT.mittel, haare: '#2b1d12', frisur: 'kurz', kopf: 'kappe', kopfFarbe: '#1e293b', kleidung: '#1e3a5f', bart: true },
  'fw-atemschutz': { name: 'Atemschutz', hintergrund: '#450a0a', haut: HAUT.hell, haare: '#000', frisur: 'keine', kopf: 'atemschutz', kopfFarbe: '#e9d23a', kleidung: '#1f2a44', streifen: '#c0c0c0' },
  'rd-notfallsani': { name: 'Notfallsanitäter', hintergrund: '#c2410c', haut: HAUT.hell, haare: '#a0522d', frisur: 'kurz', kopf: 'keiner', kleidung: '#ea580c', streifen: '#d4d4d4' },
  'rd-notaerztin': { name: 'Notärztin', hintergrund: '#9a3412', haut: HAUT.mittel, haare: '#4a2c17', frisur: 'lang', kopf: 'keiner', kleidung: '#dc2626', streifen: '#d4d4d4', brille: true },
  'rd-sani': { name: 'Rettungssanitäterin', hintergrund: '#ea580c', haut: HAUT.sehrDunkel, haare: '#111', frisur: 'zopf', kopf: 'keiner', kleidung: '#f97316', streifen: '#e5e5e5' },
  'rd-kappe': { name: 'RTW-Fahrer', hintergrund: '#7c2d12', haut: HAUT.hell, haare: '#d4a017', frisur: 'kurz', kopf: 'kappe', kopfFarbe: '#dc2626', kleidung: '#ea580c', streifen: '#d4d4d4' },
  'ls-disponent': { name: 'Disponent', hintergrund: '#1e3a8a', haut: HAUT.hell, haare: '#2b1d12', frisur: 'kurz', kopf: 'headset', kopfFarbe: '#111827', kleidung: '#1e293b' },
  'ls-disponentin': { name: 'Disponentin', hintergrund: '#1d4ed8', haut: HAUT.dunkel, haare: '#1b1b1b', frisur: 'locken', kopf: 'headset', kopfFarbe: '#111827', kleidung: '#334155' },
  'ls-chefin': { name: 'Schichtleiterin', hintergrund: '#312e81', haut: HAUT.mittel, haare: '#7c4a1e', frisur: 'zopf', kopf: 'keiner', kleidung: '#475569', brille: true },
  'ls-nacht': { name: 'Nachtschicht', hintergrund: '#0f172a', haut: HAUT.mittel, haare: '#3b2a1a', frisur: 'kurz', kopf: 'headset', kopfFarbe: '#374151', kleidung: '#3f3f46', bart: true },
};

/** SVG-Text einer Figur (64×64) */
function figurSvg(f: Figur): string {
  const teile: string[] = [];
  teile.push(`<rect width="64" height="64" fill="${f.hintergrund}"/>`);
  // Haare hinter dem Kopf (lang, Zopf, Locken)
  if (f.frisur === 'lang') teile.push(`<path d="M18 30c0-11 6-17 14-17s14 6 14 17v16H18z" fill="${f.haare}"/>`);
  if (f.frisur === 'zopf') teile.push(`<circle cx="32" cy="13" r="5" fill="${f.haare}"/>`);
  if (f.frisur === 'locken') teile.push(`<circle cx="32" cy="27" r="16" fill="${f.haare}"/>`);
  // Oberkörper mit Kragen und Reflexstreifen
  teile.push(`<path d="M10 64c0-12 9-19 22-19s22 7 22 19z" fill="${f.kleidung}"/>`);
  teile.push(`<path d="M27 45l5 6 5-6" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/>`);
  if (f.streifen) teile.push(`<rect x="12" y="56" width="40" height="3.5" fill="${f.streifen}"/>`);
  // Hals und Kopf
  teile.push(`<rect x="28" y="38" width="8" height="8" fill="${f.haut}"/>`);
  teile.push(`<circle cx="32" cy="29" r="11" fill="${f.haut}"/>`);
  // Haare oben
  if (f.frisur === 'kurz') teile.push(`<path d="M21 27c0-8 5-12 11-12s11 4 11 12c-3-4-7-5-11-5s-8 1-11 5z" fill="${f.haare}"/>`);
  if (f.frisur === 'lang' || f.frisur === 'zopf') teile.push(`<path d="M21 28c0-8 5-13 11-13s11 5 11 13c-2-5-7-7-11-7s-9 2-11 7z" fill="${f.haare}"/>`);
  if (f.frisur === 'locken') teile.push(`<path d="M21 26c1-7 5-10 11-10s10 3 11 10c-3-3-6-4-11-4s-8 1-11 4z" fill="${f.haare}"/>`);
  // Gesicht
  teile.push('<circle cx="28" cy="30" r="1.3" fill="#1b1b1b"/><circle cx="36" cy="30" r="1.3" fill="#1b1b1b"/>');
  teile.push('<path d="M28.5 34.5q3.5 2.5 7 0" fill="none" stroke="#1b1b1b" stroke-width="1.3" stroke-linecap="round"/>');
  if (f.bart) teile.push(`<path d="M22 31c1 8 5 10 10 10s9-2 10-10c-2 3-4 5-10 5s-8-2-10-5z" fill="${f.haare}"/>`);
  if (f.brille) teile.push('<g fill="none" stroke="#1b1b1b" stroke-width="1.1"><circle cx="28" cy="30" r="3"/><circle cx="36" cy="30" r="3"/><path d="M31 30h2"/></g>');
  // Kopfbedeckung
  const k = f.kopfFarbe ?? '#333';
  if (f.kopf === 'helm' || f.kopf === 'atemschutz') {
    teile.push(`<path d="M19 27c0-9 6-14 13-14s13 5 13 14z" fill="${k}"/><rect x="17" y="25.5" width="30" height="3" rx="1.5" fill="${k}"/>`);
    teile.push('<path d="M32 13v12" stroke="rgba(0,0,0,.2)" stroke-width="2"/><rect x="22" y="20" width="20" height="2" fill="rgba(255,255,255,.55)"/>');
  }
  if (f.kopf === 'atemschutz') {
    teile.push('<rect x="22" y="27" width="20" height="13" rx="6" fill="#2b2b2b"/><rect x="24.5" y="29" width="15" height="5" rx="2.5" fill="#9ec5e8"/><circle cx="32" cy="38" r="2.5" fill="#555"/>');
  }
  if (f.kopf === 'kappe') teile.push(`<path d="M21 25c0-7 5-10 11-10s11 3 11 10z" fill="${k}"/><path d="M30 24h18c0 2-2 3-4 3H30z" fill="${k}"/>`);
  if (f.kopf === 'headset') {
    teile.push(`<path d="M20 29a12 12 0 0 1 24 0" fill="none" stroke="${k}" stroke-width="2.5"/><rect x="18" y="27" width="4" height="7" rx="2" fill="${k}"/><rect x="42" y="27" width="4" height="7" rx="2" fill="${k}"/>`);
    teile.push(`<path d="M20 33q1 5 7 5" fill="none" stroke="${k}" stroke-width="1.5"/><circle cx="27.5" cy="38" r="1.5" fill="${k}"/>`);
  }
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">${teile.join('')}</svg>`;
}

/** Graue Standardfigur für alle ohne Profilbild */
const STANDARD_FIGUR = '<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">'
  + '<rect width="64" height="64" fill="#c4c4c4"/><circle cx="32" cy="27" r="11" fill="#f2f2f2"/>'
  + '<path d="M13 58c2-11 10-17 19-17s17 6 19 17a29 29 0 0 1-38 0z" fill="#f2f2f2"/></svg>';

const SVG_CACHE = new Map<string, string>();
const figurHtml = (id: AvatarVorlage) => {
  if (!SVG_CACHE.has(id)) SVG_CACHE.set(id, figurSvg(AVATAR_FIGUREN[id]));
  return SVG_CACHE.get(id)!;
};

/** Profilbild eines Kontos – rund, in jeder Größe; ohne Bild die graue Standardfigur */
export default function ProfilBild({
  konto,
  groesse = 32,
  avatar = konto.avatar,
}: {
  konto: Pick<Konto, 'id' | 'name' | 'spitzname' | 'avatar'>;
  groesse?: number;
  /** Abweichendes Bild (z. B. Vorschau bei der Auswahl) */
  avatar?: string | null;
}) {
  const stil = { width: groesse, height: groesse };
  const titel = anzeigeName(konto);
  if (avatar?.startsWith('bild:')) {
    return <img className="profilbild" style={stil} src={`/api/auth/bild/${konto.id}?v=${avatar.slice(5)}`} alt={titel} />;
  }
  const vorlage = avatar?.startsWith('vorlage:') ? (avatar.slice(8) as AvatarVorlage) : null;
  if (vorlage && AVATAR_FIGUREN[vorlage]) {
    // Feste SVG-Texte aus dieser Datei – keine Nutzereingaben
    return <span className="profilbild" style={stil} role="img" aria-label={titel} dangerouslySetInnerHTML={{ __html: figurHtml(vorlage) }} />;
  }
  return <span className="profilbild" style={stil} role="img" aria-label={titel} dangerouslySetInnerHTML={{ __html: STANDARD_FIGUR }} />;
}

/** Verkleinert ein gewähltes Bild auf ein Quadrat (Mitte ausgeschnitten) und gibt es als Base64-JPEG zurück. */
export async function bereiteProfilbildVor(datei: File): Promise<string> {
  const bild = await createImageBitmap(datei);
  const seite = Math.min(bild.width, bild.height);
  const canvas = document.createElement('canvas');
  canvas.width = PROFILBILD_GROESSE;
  canvas.height = PROFILBILD_GROESSE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Das Bild konnte nicht verarbeitet werden.');
  ctx.drawImage(bild, (bild.width - seite) / 2, (bild.height - seite) / 2, seite, seite, 0, 0, PROFILBILD_GROESSE, PROFILBILD_GROESSE);
  bild.close();
  for (const qualitaet of [0.85, 0.7, 0.5]) {
    const blob = await new Promise<Blob | null>((fertig) => canvas.toBlob(fertig, 'image/jpeg', qualitaet));
    if (blob && blob.size <= PROFILBILD_MAX_BYTES) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binaer = '';
      bytes.forEach((b) => { binaer += String.fromCharCode(b); });
      return btoa(binaer);
    }
  }
  throw new Error('Das Bild ist zu groß.');
}
