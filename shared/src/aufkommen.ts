/**
 * Einsatzaufkommen: Wie oft und welche Einsätze entstehen – abhängig von Uhrzeit, Wochentag, Wachenzahl und Wetter.
 * Es zählt die echte deutsche Uhrzeit (das Spiel läuft in Echtzeit).
 */
import { GAME_CONFIG } from './konfig.js';

export type Wetter = 'klar' | 'regen' | 'glaette' | 'hitze' | 'sturm';

export const WETTER_LABELS: Record<Wetter, string> = {
  klar: '☀️ Ruhiges Wetter',
  regen: '🌧️ Regen',
  glaette: '❄️ Glätte',
  hitze: '🔥 Hitze',
  sturm: '🌪️ Sturm',
};

export interface AufkommenKontext {
  /** Stunde 0–23 (deutsche Zeit) */
  stunde: number;
  /** 0 = Sonntag … 6 = Samstag */
  wochentag: number;
  wachen: number;
  wetter: Wetter;
}

/** Uhrzeit und Wochentag in Deutschland – unabhängig von der Zeitzone des Geräts */
export function deutscheZeit(jetzt: number): { stunde: number; wochentag: number } {
  const teile = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', hour: 'numeric', hourCycle: 'h23', weekday: 'short' })
    .formatToParts(new Date(jetzt));
  const stunde = Number(teile.find((t) => t.type === 'hour')?.value ?? 12) % 24;
  const tag = teile.find((t) => t.type === 'weekday')?.value ?? 'Mon';
  return { stunde, wochentag: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(tag) };
}

const istWochenende = (wochentag: number) => wochentag === 0 || wochentag === 6;
const istNacht = (stunde: number) => stunde < 6;
/** Berufsverkehr nur werktags */
const istBerufsverkehr = ({ stunde, wochentag }: Pick<AufkommenKontext, 'stunde' | 'wochentag'>) =>
  !istWochenende(wochentag) && ((stunde >= 7 && stunde < 9) || (stunde >= 16 && stunde < 19));
/** Partynacht: Freitag- und Samstagnacht */
const istPartynacht = ({ stunde, wochentag }: Pick<AufkommenKontext, 'stunde' | 'wochentag'>) =>
  istNacht(stunde) && (wochentag === 6 || wochentag === 0);

/** Wie viel los ist: 1 = normal am Tag, nachts etwa die Hälfte, im Berufsverkehr etwa 130 % */
export function tageszeitFaktor(kontext: Pick<AufkommenKontext, 'stunde' | 'wochentag'>): number {
  const { stunde } = kontext;
  if (istBerufsverkehr(kontext)) return 1.3;
  if (istNacht(stunde)) return istPartynacht(kontext) ? 0.75 : 0.5;
  if (stunde === 6 || stunde === 23) return 0.7;
  if (stunde >= 19) return 0.9;
  return 1;
}

const WETTER_MENGE: Record<Wetter, number> = { klar: 1, regen: 1.15, glaette: 1.3, hitze: 1.1, sturm: 1.25 };

/** Mehr Wachen = größeres Gebiet = mehr Einsätze (gedeckelt) */
export const wachenFaktor = (wachen: number) => Math.min(3, 1 + 0.35 * Math.max(0, wachen - 1));

/** Gleichzeitig offene Einsätze: wächst mit der Wachenzahl, damit größere Leitstellen gefordert bleiben */
export const maxOffeneEinsaetze = (wachen: number) => Math.min(12, GAME_CONFIG.maxOpenIncidents + 2 * Math.max(0, wachen - 1));

/** Durchschnittlicher Abstand zwischen zwei neuen Einsätzen */
export function einsatzIntervallMs(kontext: AufkommenKontext): number {
  const faktor = tageszeitFaktor(kontext) * wachenFaktor(kontext.wachen) * WETTER_MENGE[kontext.wetter];
  return GAME_CONFIG.incidentGenerationMs / faktor;
}

/** Entsteht in diesem Zeitabschnitt ein Einsatz? (Zufall mit dem passenden Durchschnitt) */
export const entstehtEinsatz = (vergangenMs: number, intervallMs: number, zufall: number = Math.random()) =>
  zufall < 1 - Math.exp(-vergangenMs / intervallMs);

const VERKEHR = ['verkehrsunfall-rd', 'verkehrsunfall-th', 'vu-eingeklemmt', 'oelspur', 'lkw-unfall', 'vu-mehrere-verletzte'];
const INTERNISTISCH = ['kreislaufprobleme', 'atemnot', 'brustschmerzen', 'bewusstlose-person', 'reanimation', 'schlaganfall', 'unterzuckerung'];
const WOHNUNGSBRAND = ['zimmerbrand', 'kellerbrand', 'gebaeudebrand', 'unklare-rauchentwicklung', 'heimrauchmelder', 'kuechenbrand-verletzt'];
const STURZ = ['sturz', 'gestuerzte-person'];
const KRANKENTRANSPORT = ['krankentransport', 'liegendtransport'];

/** Gewicht einer Einsatzvorlage im aktuellen Kontext (1 = normal) */
export function vorlagenGewicht(vorlageId: string, kontext: AufkommenKontext): number {
  let gewicht = 1;
  if (istBerufsverkehr(kontext) && VERKEHR.includes(vorlageId)) gewicht *= 2;
  if (istNacht(kontext.stunde)) {
    if (INTERNISTISCH.includes(vorlageId) || WOHNUNGSBRAND.includes(vorlageId)) gewicht *= 1.5;
    if (VERKEHR.includes(vorlageId)) gewicht *= 0.6;
    // Krankentransporte sind meist geplant und laufen tagsüber
    if (KRANKENTRANSPORT.includes(vorlageId)) gewicht *= 0.3;
  }
  if (istPartynacht(kontext) && ['verkehrsunfall-rd', 'schnittverletzung', 'bewusstlose-person', 'brennende-muelltonne', 'hilflose-person', 'containerbrand'].includes(vorlageId)) gewicht *= 1.8;
  if (istWochenende(kontext.wochentag) && !istNacht(kontext.stunde) && ['schnittverletzung', 'sturz', 'heckenbrand', 'sturz-aus-hoehe'].includes(vorlageId)) gewicht *= 1.4;
  switch (kontext.wetter) {
    case 'regen':
      if (VERKEHR.includes(vorlageId)) gewicht *= 1.6;
      break;
    case 'glaette':
      if (VERKEHR.includes(vorlageId)) gewicht *= 2.2;
      if (STURZ.includes(vorlageId)) gewicht *= 2;
      break;
    case 'hitze':
      if (vorlageId === 'kreislaufprobleme') gewicht *= 2.5;
      if (['heckenbrand', 'brennende-muelltonne', 'muelleimerbrand', 'containerbrand', 'flaechenbrand'].includes(vorlageId)) gewicht *= 2.5;
      if (vorlageId === 'allergische-reaktion') gewicht *= 1.5;
      break;
    case 'sturm':
      if (['baum-auf-strasse', 'sturmschaden', 'baum-auf-pkw'].includes(vorlageId)) gewicht *= 5;
      break;
  }
  return gewicht;
}

/** Zieht eine Vorlage – häufiger, was zu Uhrzeit, Tag und Wetter passt */
export function waehleGewichtet<T extends { id: string }>(vorlagen: T[], kontext: AufkommenKontext, zufall: number = Math.random()): T {
  const gewichte = vorlagen.map((vorlage) => vorlagenGewicht(vorlage.id, kontext));
  let rest = zufall * gewichte.reduce((summe, g) => summe + g, 0);
  for (let i = 0; i < vorlagen.length; i++) {
    rest -= gewichte[i];
    if (rest < 0) return vorlagen[i];
  }
  return vorlagen[vorlagen.length - 1];
}

/** WMO-Wettercode + Temperatur + Böen (z. B. von Open-Meteo) → Spielwetter */
export function wetterAusMessung(code: number, temperatur: number, boeenKmh: number): Wetter {
  if (boeenKmh >= 60 || code >= 95) return 'sturm';
  const schnee = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const gefrierend = code === 56 || code === 57 || code === 66 || code === 67;
  if (schnee || gefrierend || (temperatur <= 1 && code >= 51)) return 'glaette';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'regen';
  if (temperatur >= 28) return 'hitze';
  return 'klar';
}
