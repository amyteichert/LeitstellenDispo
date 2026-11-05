import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ERSTE_WACHE_HOECHSTPREIS } from '@leitstellendispo/shared';
import type { Ansicht } from './startansicht';

/**
 * Geführte Tour: Der Hinweis steht groß im Bild, alles andere ist abgedunkelt und gesperrt,
 * ein Pfeil zeigt auf das, was gerade dran ist.
 *
 * Arten von Schritten:
 * - Info: nur ansehen, weiter mit „Weiter“
 * - `tippen`: weiter, sobald man das hervorgehobene Element antippt
 * - `fertigWenn`: eine echte Aufgabe im Spiel (z. B. Wache bauen) – geht von selbst weiter, wenn sie erledigt ist
 * - `bedienbar`: das Hervorgehobene darf benutzt werden (bei `tippen` und `fertigWenn` immer)
 */

/** Was die Tour vom Spiel wissen muss, um Aufgaben als erledigt zu erkennen */
export interface TourZustand {
  wachen: number;
  /** Vorschau-Position für eine neue Wache gesetzt (Karte angetippt oder Adresse gefunden) */
  positionGewaehlt: boolean;
  offeneEinsaetze: number;
  /** Ein Einsatz ist auf der Karte geöffnet */
  kartenEinsatzOffen: boolean;
  /** Anzahl alarmierter Fahrzeuge über alle Einsätze – steigt bei jeder Alarmierung */
  alarmierungen: number;
}

interface TourSchritt {
  /** CSS-Selektor(en) der hervorgehobenen Elemente – der erste bekommt den Pfeil. Fehlt = nur Hinweis. */
  ziel?: string | string[];
  titel: string;
  text: string;
  /** Der Schritt ist geschafft, wenn man das (erste) Element antippt */
  tippen?: boolean;
  /** Aufgabe: geschafft, sobald das gilt (`start` = Zustand beim Betreten des Schritts) */
  fertigWenn?: (jetzt: TourZustand, start: TourZustand) => boolean;
  /** Hervorgehobenes darf bedient werden, weiter trotzdem über „Weiter“ */
  bedienbar?: boolean;
  /** Text, solange das Ziel noch nicht zu sehen ist */
  warteText?: string;
  /** Vor dem Schritt in diese Ansicht wechseln */
  ansicht?: Ansicht;
  /** Standort-Leiste (auf dem Handy eingeklappt) auf- oder zuklappen */
  standorte?: 'auf' | 'zu';
  /** Verschwindet das Ziel (z. B. Menü zugeklappt), einen Schritt zurück */
  zurueckWennWeg?: boolean;
  /** Nur in einer Tour ohne Wache (die Tour baut sie mit dem Spieler) */
  nurOhneWache?: boolean;
  /** Ohne Wache sinnlos – dann still überspringen */
  brauchtWache?: boolean;
  /** Beim Betreten: für den ersten Notruf sorgen, falls gerade keiner offen ist */
  ersterNotruf?: boolean;
}

const euro = (betrag: number) => `${betrag.toLocaleString('de-DE')} €`;

export const TOUR_SCHRITTE: TourSchritt[] = [
  {
    titel: 'Willkommen in deiner Leitstelle! 👋',
    text: 'Ich zeige dir Schritt für Schritt, wie du startest: Du baust deine erste Wache, nimmst deinen ersten Notruf an und schickst ein Fahrzeug los. Danach gibt es einen kurzen Rundgang. Was gerade dran ist, leuchtet – der Pfeil zeigt dir, wo. Alles andere ist so lange ausgegraut.',
  },

  // ---- Erste Wache bauen (nur wenn noch keine da ist) ----
  {
    nurOhneWache: true,
    ansicht: 'Karte',
    standorte: 'auf',
    ziel: '[data-tour="wache-bauen"]',
    bedienbar: true,
    titel: 'Schritt 1: Deine erste Wache',
    text: 'Gib ihr einen Namen (oder lass den Vorschlag stehen) und wähle die Art. Rettungswache: Notrufe für den Rettungsdienst, z. B. mit dem RTW – für den Anfang die einfachste Wahl. Feuerwache: Brände und technische Hilfe, z. B. mit dem HLF.',
  },
  {
    nurOhneWache: true,
    ansicht: 'Karte',
    standorte: 'auf',
    ziel: ['[data-tour="wache-adresse"]', '.map-view'],
    fertigWenn: (jetzt) => jetzt.positionGewaehlt,
    titel: 'Wo soll sie stehen?',
    text: 'Gib eine Adresse ein (am besten aus deiner Stadt) und tippe auf „Adresse suchen“ – oder tippe direkt auf die Karte. Dort erscheint dann eine Vorschau. Sobald eine Position gewählt ist, geht es von selbst weiter.',
  },
  {
    nurOhneWache: true,
    ansicht: 'Karte',
    standorte: 'auf',
    ziel: '[data-tour="wache-start"]',
    bedienbar: true,
    titel: 'Dein Startfahrzeug',
    text: `Zur Wache gehört ein Fahrzeug samt Besatzung. Den Funkrufnamen kannst du frei wählen. Darunter siehst du, was alles zusammen kostet. Die Wache selbst kostet beim ersten Mal höchstens ${euro(ERSTE_WACHE_HOECHSTPREIS)}, das Fahrzeug kommt dazu.`,
  },
  {
    nurOhneWache: true,
    ansicht: 'Karte',
    standorte: 'auf',
    ziel: '[data-tour="wache-erstellen"]',
    fertigWenn: (jetzt, start) => jetzt.wachen > start.wachen,
    titel: 'Wache eröffnen',
    text: 'Tippe auf „Standort erstellen“ und bestätige den Kauf.',
  },
  {
    nurOhneWache: true,
    ansicht: 'Karte',
    standorte: 'zu',
    titel: 'Deine Wache steht! 🎉',
    text: 'Fahrzeug und Besatzung sind einsatzbereit. Ab jetzt gehen Notrufe aus der Umgebung bei dir ein – und gleich kommt dein erster.',
  },

  // ---- Erster Einsatz ----
  {
    brauchtWache: true,
    ansicht: 'Karte',
    standorte: 'zu',
    ersterNotruf: true,
    ziel: '[data-tour="karte-einsaetze"]',
    fertigWenn: (jetzt) => jetzt.kartenEinsatzOffen,
    warteText: 'Dein erster Notruf geht gleich ein …',
    titel: 'Ein Notruf geht ein! 📞',
    text: 'Oben auf der Karte stehen alle offenen Einsätze. Tippe den Einsatz an, um ihn zu öffnen.',
  },
  {
    brauchtWache: true,
    ziel: '[data-tour="einsatz-panel"]',
    titel: 'Der Einsatz im Überblick',
    text: 'Oben stehen Stichwort und Adresse. Darunter siehst du, was gebraucht wird: ✗ fehlt noch, → ist unterwegs, ✓ ist vor Ort. Je schneller die passenden Fahrzeuge da sind, desto besser.',
  },
  {
    brauchtWache: true,
    ziel: '[data-tour="alarm-auswahl"]',
    fertigWenn: (jetzt, start) => jetzt.alarmierungen > start.alarmierungen,
    titel: 'Fahrzeug alarmieren 🚨',
    text: 'Setz einen Haken beim passenden Fahrzeug – oder tippe auf „Vorschlag“, dann wählt das Spiel für dich. Danach auf „Alarmieren“. Bei jedem Fahrzeug steht, wie lange es braucht.',
  },
  {
    brauchtWache: true,
    titel: 'Stark – dein Fahrzeug ist unterwegs! 🚑',
    text: 'Es fährt über echte Straßen zum Einsatz, du siehst es auf der Karte fahren. Vor Ort arbeitet die Besatzung, danach fährt sie zurück zur Wache. Für jeden Einsatz gibt es Geld, Erfahrung und Ruf – je schneller und passender, desto mehr.',
  },

  // ---- Rundgang ----
  { ziel: '[data-tour="ruf"]', titel: 'Dein Ruf ⭐', text: 'Schnelle, richtige Alarmierungen verbessern deinen Ruf – je besser er ist, desto höher der Bonus pro Einsatz. Antippen zeigt dir später, was gut lief und was nicht.' },
  { ziel: '[data-tour="rang"]', titel: 'Dein Rang', text: 'Mit jedem Einsatz sammelst du Erfahrungspunkte und steigst im Rang auf. Höhere Ränge schalten neue Fahrzeuge frei. Antippen zeigt Ränge und Erfolge.' },
  { ziel: '[data-tour="menue"]', tippen: true, titel: 'Das Menü', text: 'Hier wechselst du zwischen allen Bereichen. Tippe es an.' },
  { ziel: '[data-tour="menu-Wachen"]', tippen: true, zurueckWennWeg: true, titel: 'Deine Wachen', text: 'Tippe auf „Wachen“.' },
  { brauchtWache: true, ansicht: 'Wachen', ziel: '[data-tour="wache-verwalten"]', tippen: true, titel: 'Wache verwalten', text: 'Jede Wache hat ihre eigene Verwaltung. Tippe auf „Verwalten“.' },
  { brauchtWache: true, ziel: '[data-tour="wache-reiter"]', titel: 'Alles rund um die Wache', text: 'In diesen Reitern verwaltest du die Wache. Über ✎ neben dem Namen änderst du Name, Logo (Farbe und Symbol) und die Fahrzeugfarbe.' },
  { brauchtWache: true, ziel: '[data-tour="reiter-Fahrzeuge"]', tippen: true, titel: 'Fahrzeuge', text: 'Tippe auf „Fahrzeuge“ – hier kaufst du neue Fahrzeuge, solange Stellplätze frei sind.' },
  { brauchtWache: true, ziel: '[data-tour="reiter-Personal"]', tippen: true, titel: 'Personal', text: 'Ein Fahrzeug fährt nur mit Besatzung los. Tippe auf „Personal“: Hier stellst du Bewerber ein (neue kommen alle 24 Stunden) und teilst sie den Fahrzeugen zu. Suche und Filter helfen bei vielen Leuten.' },
  { brauchtWache: true, ziel: '[data-tour="reiter-Ausbau"]', titel: 'Ausbildung & Ausbau', text: 'Unter „Ausbildung“ qualifizierst du dein Personal weiter (z. B. zum Notfallsanitäter). Unter „Ausbau“ gibt es mehr Stellplätze, Ruheräume für mehr Personal und Räume, die dein Team zufrieden halten.' },
  { ansicht: 'Einsätze', ziel: '[data-tour="einsatz-liste"]', titel: 'Alle Einsätze', text: 'Hier stehen alle Notrufe mit allen Details. Du kannst von hier genauso alarmieren wie auf der Karte.' },
  { ansicht: 'AAO', ziel: '[data-tour="aao"]', titel: 'AAO – deine Alarm-Knöpfe', text: 'Lege eigene Knöpfe an, z. B. „Löschzug“ oder „RTW + NEF“. Beim Einsatz wählt ein Tipp darauf gleich alle passenden Fahrzeuge aus – spart viel Zeit, wenn du größer wirst.' },
  { ansicht: 'Funk', ziel: '[data-tour="funk"]', titel: 'Funk', text: 'Statusmeldungen deiner Fahrzeuge. Meldet sich eins mit Status 5 (Sprechwunsch), gib ihm eine Sprechaufforderung – dann erfährst du, was es braucht, z. B. Verstärkung.' },
  { ansicht: 'Finanzen', ziel: '[data-tour="finanzen"]', titel: 'Finanzen', text: 'Alle Einnahmen und Ausgaben auf einen Blick. Jeder Einsatz bringt Geld – je besser dein Ruf, desto mehr Bonus.' },
  { ansicht: 'Wachen', ziel: '[data-tour="wache-kaufen"]', titel: 'Weitere Wachen', text: 'Wird dein Gebiet zu groß oder die Anfahrt zu lang? Hier kaufst du weitere Wachen. Vor dem Kauf siehst du immer den Preis.' },
  {
    ansicht: 'Karte',
    titel: 'Bereit für deine Schicht! ✓',
    text: 'Das war’s! Die Liste „Erste Schritte“ auf der Karte zeigt dir, was als Nächstes ansteht. Die Tour findest du jederzeit unter Einstellungen → „Tour starten“. Viel Erfolg in der Leitstelle!',
  },
];

const tourKey = (kontoId: number) => `leitstellendispo.tour.${kontoId}`;

export function tourGesehen(kontoId: number): boolean {
  try {
    return localStorage.getItem(tourKey(kontoId)) === 'fertig';
  } catch {
    return true; // ohne Speicher lieber nicht bei jedem Start aufdrängen
  }
}

function merkeTourGesehen(kontoId: number) {
  try {
    localStorage.setItem(tourKey(kontoId), 'fertig');
  } catch {
    // dann eben beim nächsten Mal wieder
  }
}

type Rechteck = { top: number; left: number; width: number; height: number };
type Punkt = { x: number; y: number };
const RAND = 6;
const ABSTAND = 16;

const zielSelektoren = (schritt: TourSchritt) => (schritt.ziel === undefined ? [] : Array.isArray(schritt.ziel) ? schritt.ziel : [schritt.ziel]);
const istBedienbar = (schritt: TourSchritt) => Boolean(schritt.tippen || schritt.fertigWenn || schritt.bedienbar);

const ueberlappen = (a: Rechteck, b: Rechteck, rand = 0) =>
  a.left < b.left + b.width + rand && b.left < a.left + a.width + rand && a.top < b.top + b.height + rand && b.top < a.top + a.height + rand;

const ueberlappFlaeche = (a: Rechteck, b: Rechteck) =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

/**
 * Platz für den Hinweis: am liebsten mittig, sonst neben dem Hervorgehobenen (darunter, darüber, rechts, links),
 * im Notfall dort, wo er am wenigsten verdeckt.
 */
function findeBoxPlatz(breite: number, hoehe: number, loecher: Rechteck[], vw: number, vh: number): Punkt {
  const mitte = (start: number, laenge: number, groesse: number) => start + Math.max(0, (laenge - groesse) / 2);
  const kandidaten: Punkt[] = [{ x: (vw - breite) / 2, y: (vh - hoehe) / 2 }];
  const haupt = loecher[0];
  if (haupt) {
    const unten = haupt.top + haupt.height + ABSTAND;
    const rechts = haupt.left + haupt.width + ABSTAND;
    kandidaten.push(
      { x: (vw - breite) / 2, y: mitte(unten, vh - unten, hoehe) },
      { x: (vw - breite) / 2, y: mitte(0, haupt.top - ABSTAND, hoehe) },
      { x: mitte(rechts, vw - rechts, breite), y: (vh - hoehe) / 2 },
      { x: mitte(0, haupt.left - ABSTAND, breite), y: (vh - hoehe) / 2 },
    );
  }
  kandidaten.push({ x: (vw - breite) / 2, y: vh - hoehe - 12 }, { x: (vw - breite) / 2, y: 12 });
  const passend = kandidaten
    .map((p) => ({ x: Math.min(Math.max(12, p.x), vw - breite - 12), y: Math.min(Math.max(12, p.y), vh - hoehe - 12) }))
    .map((p) => {
      const box = { left: p.x, top: p.y, width: breite, height: hoehe };
      return { p, frei: !loecher.some((loch) => ueberlappen(box, loch, 8)), verdeckt: loecher.reduce((s, loch) => s + ueberlappFlaeche(box, loch), 0) };
    });
  return (passend.find((k) => k.frei) ?? passend.sort((a, b) => a.verdeckt - b.verdeckt)[0]).p;
}

/** Schnittpunkt der Linie von der Mitte des Rechtecks Richtung `nach` mit seinem Rand */
function randPunkt(r: Rechteck, nach: Punkt): Punkt {
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const dx = nach.x - cx;
  const dy = nach.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const faktor = Math.min(dx === 0 ? Infinity : r.width / 2 / Math.abs(dx), dy === 0 ? Infinity : r.height / 2 / Math.abs(dy));
  return { x: cx + dx * faktor, y: cy + dy * faktor };
}

export default function Tour({ kontoId, hatWache, zustand, onAnsicht, onStandorte, onErsterNotruf, onEnde }: {
  kontoId: number;
  /** Gibt es beim Start schon eine Wache? Dann entfallen die Schritte zum Wachenbau. */
  hatWache: boolean;
  zustand: TourZustand;
  onAnsicht: (ansicht: Ansicht) => void;
  onStandorte: (offen: boolean) => void;
  /** Sorgt für einen Notruf, wenn gerade keiner offen ist */
  onErsterNotruf: () => void;
  onEnde: () => void;
}) {
  // Beim Start festlegen, damit sich die Schrittzahl während der Tour nicht ändert
  const [schritte] = useState(() => TOUR_SCHRITTE.filter((s) => !(hatWache && s.nurOhneWache)));
  const [index, setIndex] = useState(0);
  const [loecher, setLoecher] = useState<Rechteck[]>([]);
  const [boxGroesse, setBoxGroesse] = useState({ breite: 0, hoehe: 0 });
  const [fenster, setFenster] = useState({ vw: window.innerWidth, vh: window.innerHeight });
  /** Ziel ist auch nach einigen Sekunden nicht da – dann Überspringen anbieten */
  const [fehlt, setFehlt] = useState(false);
  /** Wurde das Ziel des aktuellen Tipp-Schritts schon angetippt? */
  const angetippt = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const zustandRef = useRef(zustand);
  zustandRef.current = zustand;
  /** Zustand beim Betreten des Schritts – für Aufgaben wie „eine Wache mehr als vorher“ */
  const startZustand = useRef(zustand);
  const schritt = schritte[index];
  const letzter = index === schritte.length - 1;

  const beenden = () => {
    merkeTourGesehen(kontoId);
    onEnde();
  };
  /** Weiter zum nächsten Schritt – nur, wenn wir noch auf `von` stehen (verhindert Doppelsprünge) */
  const weiterVon = (von: number) => {
    if (von === schritte.length - 1) beenden();
    else setIndex((i) => (i === von ? i + 1 : i));
  };
  const weiter = () => weiterVon(index);

  // Beim Betreten eines Schritts: Ansicht, Standort-Leiste, erster Notruf
  useLayoutEffect(() => {
    startZustand.current = zustandRef.current;
    if (schritt.ansicht) onAnsicht(schritt.ansicht);
    if (schritt.standorte) onStandorte(schritt.standorte === 'auf');
    if (schritt.ersterNotruf && zustandRef.current.wachen > 0 && zustandRef.current.offeneEinsaetze === 0) onErsterNotruf();
  }, [index]);

  // Aufgaben erledigt (oder ohne Wache sinnlos)? Dann von selbst weiter.
  useEffect(() => {
    if ((schritt.brauchtWache && zustand.wachen === 0) || schritt.fertigWenn?.(zustand, startZustand.current)) weiterVon(index);
  });

  // Fenstergröße für die Platzierung
  useEffect(() => {
    const beiGroesse = () => setFenster({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener('resize', beiGroesse);
    return () => window.removeEventListener('resize', beiGroesse);
  }, []);

  // Zielelemente suchen und ihre Position verfolgen (sie können erst nach einem Ansichtswechsel erscheinen).
  // Geprüft wird alle 100 ms (nicht bei jedem Bild – das hat die Seite ausgebremst).
  useLayoutEffect(() => {
    setLoecher([]);
    setFehlt(false);
    angetippt.current = false;
    const selektoren = zielSelektoren(schritt);
    const start = performance.now();
    let gescrollt = false;
    const messen = () => {
      const box = boxRef.current;
      if (box) {
        const breite = box.offsetWidth;
        const hoehe = box.offsetHeight;
        setBoxGroesse((alt) => (alt.breite === breite && alt.hoehe === hoehe ? alt : { breite, hoehe }));
      }
      if (selektoren.length === 0) return;
      const elemente = selektoren.map((s) => document.querySelector(s)).filter((e): e is Element => e !== null);
      if (elemente.length === 0) {
        setLoecher((alt) => (alt.length === 0 ? alt : []));
        const gewartet = performance.now() - start;
        // Nur beim Menüpunkt: Menü zugeklappt → zurück zu „Menü antippen“
        // (nicht, wenn das Element gerade angetippt wurde – dann verschwindet es ja absichtlich)
        if (schritt.zurueckWennWeg && gewartet > 800 && !angetippt.current) setIndex((i) => (i === index ? Math.max(0, i - 1) : i));
        // Sonst nie im Kreis laufen: nach einigen Sekunden „Überspringen“ anbieten
        else if (gewartet > (schritt.warteText ? 8000 : 3000)) setFehlt(true);
        return;
      }
      setFehlt(false);
      if (!gescrollt) {
        elemente[0].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        gescrollt = true;
      }
      const neu = elemente.map((element) => {
        const r = element.getBoundingClientRect();
        return { top: r.top - RAND, left: r.left - RAND, width: r.width + 2 * RAND, height: r.height + 2 * RAND };
      });
      setLoecher((alt) => (alt.length === neu.length && alt.every((a, i) => a.top === neu[i].top && a.left === neu[i].left && a.width === neu[i].width && a.height === neu[i].height)
        ? alt
        : neu));
    };
    messen();
    const intervall = setInterval(messen, 100);
    return () => clearInterval(intervall);
  }, [index]);

  // Alles außer dem Hinweis (und bei bedienbaren Schritten dem Hervorgehobenen) sperren.
  // Läuft vor allen anderen Klick-Handlern (Capture auf window) – so funktioniert es auch mit mehreren Zielen und der Karte.
  useEffect(() => {
    const erlaubt = (ziel: EventTarget | null) => {
      if (!(ziel instanceof Node)) return false;
      if (boxRef.current?.contains(ziel)) return true;
      if (!istBedienbar(schritt)) return false;
      return zielSelektoren(schritt).some((s) => document.querySelector(s)?.contains(ziel));
    };
    const sperren = (event: Event) => {
      if (erlaubt(event.target)) return;
      event.stopPropagation();
      // Berühren nicht verhindern – sonst ginge auf dem Handy kein Scrollen mehr; der folgende Klick wird gesperrt
      if (event.type !== 'touchstart' && event.type !== 'pointerdown' && event.cancelable) event.preventDefault();
    };
    const arten = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'contextmenu'];
    arten.forEach((art) => window.addEventListener(art, sperren, { capture: true, passive: false }));
    return () => arten.forEach((art) => window.removeEventListener(art, sperren, { capture: true }));
  }, [index]);

  // Bei Tipp-Schritten: weiter, sobald das hervorgehobene Element angetippt wurde (nur einmal pro Schritt)
  useEffect(() => {
    const selektor = zielSelektoren(schritt)[0];
    if (!schritt.tippen || !selektor) return;
    let erledigt = false;
    const beiKlick = (event: MouseEvent) => {
      const ziel = document.querySelector(selektor);
      if (!erledigt && ziel && event.target instanceof Node && ziel.contains(event.target)) {
        erledigt = true;
        angetippt.current = true;
        // Sofort weiter: Das Element ist während dieses Klicks noch da, seine eigene Aktion läuft trotzdem
        setIndex((i) => (i === index ? i + 1 : i));
      }
    };
    document.addEventListener('click', beiKlick, true);
    return () => document.removeEventListener('click', beiKlick, true);
  }, [index]);

  // Escape beendet die Tour
  useEffect(() => {
    const beiTaste = (event: KeyboardEvent) => event.key === 'Escape' && beenden();
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, []);

  const { vw, vh } = fenster;
  const wartetAufZiel = zielSelektoren(schritt).length > 0 && loecher.length === 0;
  const platz = findeBoxPlatz(boxGroesse.breite || Math.min(460, vw - 24), boxGroesse.hoehe || 240, loecher, vw, vh);
  const boxRechteck: Rechteck = { left: platz.x, top: platz.y, width: boxGroesse.breite, height: boxGroesse.hoehe };

  // Pfeil vom Hinweis zum (ersten) Hervorgehobenen – nicht bei riesigen Zielen (z. B. der ganzen Karte) oder wenn es zu nah ist
  const haupt = loecher[0];
  let pfeil: { start: Punkt; ende: Punkt; knick: Punkt } | null = null;
  if (haupt && boxGroesse.breite > 0 && haupt.width * haupt.height < 0.35 * vw * vh && !ueberlappen(boxRechteck, haupt)) {
    const lochMitte = { x: haupt.left + haupt.width / 2, y: haupt.top + haupt.height / 2 };
    const boxMitte = { x: platz.x + boxGroesse.breite / 2, y: platz.y + boxGroesse.hoehe / 2 };
    const start = randPunkt(boxRechteck, lochMitte);
    const randZiel = randPunkt(haupt, boxMitte);
    const laenge = Math.hypot(randZiel.x - start.x, randZiel.y - start.y);
    if (laenge > 28) {
      // Spitze etwas vor dem Rahmen, damit sie ihn nicht verdeckt
      const ende = { x: randZiel.x - ((randZiel.x - start.x) / laenge) * 8, y: randZiel.y - ((randZiel.y - start.y) / laenge) * 8 };
      // Leicht gebogen wirkt freundlicher als ein gerader Strich
      const knick = { x: (start.x + ende.x) / 2 + (ende.y - start.y) * 0.18, y: (start.y + ende.y) / 2 - (ende.x - start.x) * 0.18 };
      pfeil = { start, ende, knick };
    }
  }

  const aufgabe = Boolean(schritt.fertigWenn);

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label="Tour durchs Spiel">
      {/* Abdunkeln mit Löchern für die hervorgehobenen Elemente (nur Optik – gesperrt wird oben per Event) */}
      <svg className="tour__dunkel" width={vw} height={vh} aria-hidden>
        <defs>
          <mask id="tour-maske">
            <rect width={vw} height={vh} fill="white" />
            {loecher.map((loch, i) => <rect key={i} x={loch.left} y={loch.top} width={loch.width} height={loch.height} rx={10} fill="black" />)}
          </mask>
          <marker id="tour-pfeilspitze" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="tour__pfeilspitze" />
          </marker>
        </defs>
        <rect width={vw} height={vh} className="tour__schleier" mask="url(#tour-maske)" />
        {pfeil && (
          <path
            className="tour__pfeil"
            d={`M ${pfeil.start.x} ${pfeil.start.y} Q ${pfeil.knick.x} ${pfeil.knick.y} ${pfeil.ende.x} ${pfeil.ende.y}`}
            markerEnd="url(#tour-pfeilspitze)"
          />
        )}
      </svg>
      {loecher.map((loch, i) => (
        <div key={i} className={`tour__rahmen ${istBedienbar(schritt) ? 'tour__rahmen--aktiv' : ''}`} style={loch} />
      ))}

      <div ref={boxRef} className="tour__box" style={{ left: platz.x, top: platz.y }}>
        <div className="tour__fortschritt" aria-hidden>
          <span style={{ width: `${((index + 1) / schritte.length) * 100}%` }} />
        </div>
        <small>Schritt {index + 1} von {schritte.length}</small>
        <h3>{schritt.titel}</h3>
        <p>
          {!wartetAufZiel
            ? schritt.text
            : fehlt
              ? 'Dieser Bereich ist gerade nicht zu sehen – du kannst den Schritt überspringen.'
              : schritt.warteText ?? 'Einen Moment …'}
        </p>
        <div className="tour__knoepfe">
          {letzter ? (
            <span />
          ) : (
            // Klein und mit Rückfrage, damit man nicht versehentlich draufkommt
            <button
              type="button"
              className="tour__beenden"
              onClick={() => window.confirm('Tour wirklich beenden? Du kannst sie später in den Einstellungen neu starten.') && beenden()}
            >
              Tour beenden
            </button>
          )}
          {wartetAufZiel ? (
            fehlt && <button type="button" className="btn btn--primary" onClick={weiter}>Überspringen</button>
          ) : schritt.tippen ? (
            <span className="tour__tipp">👉 Tippe auf das Leuchtende</span>
          ) : aufgabe ? (
            <span className="tour__aufgabe">
              <span className="tour__tipp">Mach es einfach – es geht von selbst weiter</span>
              <button type="button" className="tour__beenden" onClick={weiter}>Schritt überspringen</button>
            </span>
          ) : (
            <button type="button" className="btn btn--primary" onClick={weiter} autoFocus>{letzter ? 'Los geht’s!' : 'Weiter'}</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
