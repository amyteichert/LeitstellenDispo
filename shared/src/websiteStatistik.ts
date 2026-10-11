/**
 * Besucherstatistik der Website (leitstellendispo.de): Herkunft einordnen und Verhalten bewerten.
 * Bewusst anonym – keine Cookies, keine IP-Adressen; der Server speichert nur einen täglich wechselnden Besucher-Code.
 */

/** Woher ein Besuch kam */
export type QuellenArt = 'kampagne' | 'suche' | 'link' | 'direkt' | 'intern';

export const QUELLEN_LABELS: Record<QuellenArt, string> = {
  kampagne: 'Geteilter Link',
  suche: 'Suchmaschine',
  link: 'Andere Website',
  direkt: 'Direkt / unbekannt',
  intern: 'Innerhalb der Website',
};

/** Wie sich jemand verhalten hat */
export type BesuchsVerhalten = 'interagiert' | 'gelesen' | 'kurz';

export const VERHALTEN_LABELS: Record<BesuchsVerhalten, string> = {
  interagiert: 'Interagiert',
  gelesen: 'Gelesen',
  kurz: 'Nur kurz da',
};

/** Welche Seite gezählt wurde: die Info-Website (leitstellendispo.de) oder das Spiel (spiel.leitstellendispo.de) */
export type WebsiteBereich = 'info' | 'spiel';

export const BEREICH_LABELS: Record<WebsiteBereich, string> = {
  info: 'leitstellendispo.de',
  spiel: 'spiel.leitstellendispo.de',
};

/**
 * Was jemand erreicht hat. Info-Website: Klick aufs Spiel, Discord, andere Seite, externer Link.
 * Spiel: registriert, angemeldet (über das Formular) oder mit Konto im Spiel gewesen.
 */
export const BESUCHS_ZIELE = ['spielen', 'discord', 'intern', 'extern', 'registriert', 'angemeldet', 'gespielt'] as const;
export type BesuchsZiel = (typeof BESUCHS_ZIELE)[number];

export const WEBSITE_STATISTIK_CONFIG = {
  /** Ab so vielen Sekunden auf der Seite gilt ein Besuch als gelesen … */
  gelesenAbSekunden: 30,
  /** … oder ab so viel Prozent gescrollt */
  gelesenAbScrollProzent: 50,
  /** Einträge werden nach dieser Zeit gelöscht (Tage) */
  aufbewahrungTage: 400,
} as const;

const SUCHMASCHINEN: Array<[RegExp, string]> = [
  [/(^|\.)google\./, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)ecosia\.org$/, 'Ecosia'],
  [/(^|\.)search\.yahoo\.com$|(^|\.)yahoo\./, 'Yahoo'],
  [/(^|\.)qwant\.com$/, 'Qwant'],
  [/(^|\.)startpage\.com$/, 'Startpage'],
  [/(^|\.)yandex\./, 'Yandex'],
  [/(^|\.)baidu\.com$/, 'Baidu'],
];

const BEKANNTE_SEITEN: Array<[RegExp, string]> = [
  [/(^|\.)discord(app)?\.(com|gg)$/, 'Discord'],
  [/(^|\.)whatsapp\.(com|net)$/, 'WhatsApp'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, 'Facebook'],
  [/(^|\.)t\.co$|(^|\.)(x|twitter)\.com$/, 'X / Twitter'],
  [/(^|\.)reddit\.com$/, 'Reddit'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'YouTube'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)t\.me$|(^|\.)telegram\.org$/, 'Telegram'],
];

/** Kennzeichen aus `?von=…` säubern: nur Kleinbuchstaben, Ziffern, - und _ (höchstens 40 Zeichen) */
export function saeubereKampagne(von: unknown): string | null {
  if (typeof von !== 'string') return null;
  const sauber = von.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  return sauber || null;
}

const hostVon = (adresse: string): string | null => {
  try {
    return new URL(adresse).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

/**
 * Ordnet die Herkunft eines Seitenaufrufs ein. Ein `?von=`-Kennzeichen hat Vorrang (z. B. aus einer WhatsApp-Gruppe,
 * die selbst keine Herkunft mitschickt). Aufrufe von der eigenen Website zählen als „intern“ (Weiterklicken).
 */
export function ordneQuelleEin(
  referrer: string | null | undefined,
  von: string | null | undefined,
  eigeneHosts: readonly string[],
): { art: QuellenArt; name: string | null } {
  const kampagne = saeubereKampagne(von);
  if (kampagne) return { art: 'kampagne', name: kampagne };
  const host = referrer ? hostVon(referrer) : null;
  if (!host) return { art: 'direkt', name: null };
  if (eigeneHosts.some((eigen) => host === eigen || host.endsWith(`.${eigen}`))) return { art: 'intern', name: null };
  const suche = SUCHMASCHINEN.find(([muster]) => muster.test(host));
  if (suche) return { art: 'suche', name: suche[1] };
  const bekannt = BEKANNTE_SEITEN.find(([muster]) => muster.test(host));
  return { art: 'link', name: bekannt ? bekannt[1] : host };
}

/** Verhalten aus Verweildauer, Scrolltiefe und Klicks */
export function bewerteBesuch(besuch: { dauerSekunden: number; scrollProzent: number; interaktion: boolean }): BesuchsVerhalten {
  if (besuch.interaktion) return 'interagiert';
  if (besuch.dauerSekunden >= WEBSITE_STATISTIK_CONFIG.gelesenAbSekunden || besuch.scrollProzent >= WEBSITE_STATISTIK_CONFIG.gelesenAbScrollProzent) {
    return 'gelesen';
  }
  return 'kurz';
}

/** Auswertung für den Team-Bereich */
export interface WebsiteStatistik {
  zeitraumTage: number | null;
  /** null = beide Seiten zusammen (dieselbe Person zählt einmal) */
  bereich: WebsiteBereich | null;
  aufrufe: number;
  besucher: number;
  verhalten: Record<BesuchsVerhalten, number>;
  quellen: Array<{ art: QuellenArt; besucher: number }>;
  /** Einzelne Herkünfte (Suchmaschine, Seite oder ?von=-Kennzeichen), meiste zuerst */
  herkuenfte: Array<{ art: QuellenArt; name: string; besucher: number }>;
  seiten: Array<{ seite: string; aufrufe: number }>;
  ziele: Array<{ ziel: BesuchsZiel; besucher: number }>;
  /** Je Tag (JJJJ-MM-TT), älteste zuerst */
  tage: Array<{ tag: string; aufrufe: number; besucher: number }>;
}
