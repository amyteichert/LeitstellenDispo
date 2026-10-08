import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Ansicht } from './startansicht';

/**
 * Geführte Tour: dunkelt alles ab bis auf ein hervorgehobenes Element. Nur dieses ist antippbar.
 * Schritte mit `tippen` gehen weiter, sobald man das Element antippt; die anderen über „Weiter“.
 */
interface TourSchritt {
  /** CSS-Selektor des Elements – fehlt = Hinweis in der Bildschirmmitte */
  ziel?: string;
  titel: string;
  text: string;
  /** Der Schritt ist erst geschafft, wenn man das Element antippt */
  tippen?: boolean;
  /** Vor dem Schritt in diese Ansicht wechseln */
  ansicht?: Ansicht;
}

export const TOUR_SCHRITTE: TourSchritt[] = [
  { titel: 'Willkommen in deiner Leitstelle! 🚨', text: 'In ein paar Schritten zeige ich dir, wie alles funktioniert. Du kannst die Tour jederzeit beenden und später in den Einstellungen wiederholen.' },
  { ziel: '[data-tour="ruf"]', titel: 'Dein Ruf', text: 'Schnelle, richtige Alarmierungen verbessern deinen Ruf – und je besser er ist, desto höher der Leistungsbonus. Später kannst du hier antippen und sehen, was gut lief und was nicht.' },
  { ziel: '[data-tour="menue"]', titel: 'Das Menü', text: 'Hier wechselst du zwischen den Bereichen. Tippe es an.', tippen: true },
  { ziel: '[data-tour="menu-Wachen"]', titel: 'Deine Wachen', text: 'Tippe auf „Wachen“.', tippen: true },
  { ziel: '[data-tour="wache-verwalten"]', titel: 'Wache verwalten', text: 'Jede Wache hat ihre eigene Verwaltung. Tippe auf „Verwalten“.', tippen: true },
  { ziel: '[data-tour="wache-reiter"]', titel: 'Alles rund um die Wache', text: 'Fahrzeuge kaufen, Personal einstellen und zuweisen, Lehrgänge starten und die Wache ausbauen. Tipp: Neue Fahrzeuge brauchen erst Personal, bevor sie ausrücken können.' },
  { ansicht: 'Einsätze', ziel: '[data-tour="einsatz-liste"]', titel: 'Einsätze', text: 'Hier kommen die Notrufe rein. Wähle einen Einsatz, schau dir die empfohlenen Kräfte an und alarmiere die nächsten freien Fahrzeuge – die Anfahrtszeit zählt!' },
  { ansicht: 'Funk', ziel: '[data-tour="funk"]', titel: 'Funk', text: 'Statusmeldungen deiner Fahrzeuge. Meldet sich ein Fahrzeug mit Status 5 (Sprechwunsch), gib ihm eine Sprechaufforderung – dann erfährst du, was es braucht.' },
  { ansicht: 'Karte', ziel: '.map-view', titel: 'Die Karte', text: 'Hier siehst du Wachen, Einsätze und Fahrzeuge in Echtzeit. Tippe einen Einsatz an, um direkt von der Karte zu alarmieren.' },
  { titel: 'Bereit für deine Schicht! ✅', text: 'Das war die Tour. Viel Erfolg in der Leitstelle! Du findest sie jederzeit unter Einstellungen → „Tour starten“.' },
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
const RAND = 6;

export default function Tour({ kontoId, onAnsicht, onEnde }: { kontoId: number; onAnsicht: (ansicht: Ansicht) => void; onEnde: () => void }) {
  const [index, setIndex] = useState(0);
  const [rechteck, setRechteck] = useState<Rechteck | null>(null);
  const schritt = TOUR_SCHRITTE[index];
  const letzter = index === TOUR_SCHRITTE.length - 1;

  const beenden = () => {
    merkeTourGesehen(kontoId);
    onEnde();
  };
  const weiter = () => (letzter ? beenden() : setIndex((i) => i + 1));

  // Ansicht wechseln, wenn der Schritt es verlangt
  useEffect(() => {
    if (schritt.ansicht) onAnsicht(schritt.ansicht);
  }, [index]);

  // Zielelement suchen und seine Position verfolgen (es kann erst nach einem Ansichtswechsel erscheinen)
  useLayoutEffect(() => {
    setRechteck(null);
    if (!schritt.ziel) return;
    let aktiv = true;
    let element: Element | null = null;
    const start = performance.now();
    const messen = () => {
      if (!aktiv) return;
      element = document.querySelector(schritt.ziel!);
      // Ziel taucht nicht auf (z. B. Menü wieder zugeklappt): einen Schritt zurück statt hängenzubleiben
      if (!element && index > 0 && TOUR_SCHRITTE[index - 1].tippen && performance.now() - start > 1500) {
        setIndex(index - 1);
        return;
      }
      if (element) {
        const r = element.getBoundingClientRect();
        setRechteck((alt) => (alt && alt.top === r.top && alt.left === r.left && alt.width === r.width && alt.height === r.height
          ? alt
          : { top: r.top, left: r.left, width: r.width, height: r.height }));
        if (index > 0) element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      requestAnimationFrame(messen);
    };
    messen();
    return () => { aktiv = false; };
  }, [index]);

  // Bei Tipp-Schritten: weiter, sobald das hervorgehobene Element angetippt wurde
  useEffect(() => {
    if (!schritt.tippen || !schritt.ziel) return;
    const beiKlick = (event: MouseEvent) => {
      const ziel = document.querySelector(schritt.ziel!);
      if (ziel && event.target instanceof Node && ziel.contains(event.target)) setTimeout(weiter, 150);
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

  const loch = rechteck && {
    top: rechteck.top - RAND,
    left: rechteck.left - RAND,
    width: rechteck.width + 2 * RAND,
    height: rechteck.height + 2 * RAND,
  };
  const wartetAufZiel = Boolean(schritt.ziel && !loch);

  // Textfeld unter dem Element – oder darüber, wenn unten kein Platz ist
  const unten = loch ? loch.top + loch.height + 12 : 0;
  const passtUnten = loch ? unten + 200 < window.innerHeight : true;
  const boxStil: React.CSSProperties = loch
    ? {
      top: passtUnten ? unten : Math.max(12, loch.top - 12 - 200),
      left: Math.min(Math.max(12, loch.left), window.innerWidth - 332),
    }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label="Tour durchs Spiel">
      {loch ? (
        <>
          {/* Vier Blöcke um das Loch herum sperren alles andere */}
          <div className="tour__sperre" style={{ top: 0, left: 0, right: 0, height: Math.max(0, loch.top) }} />
          <div className="tour__sperre" style={{ top: loch.top + loch.height, left: 0, right: 0, bottom: 0 }} />
          <div className="tour__sperre" style={{ top: loch.top, left: 0, width: Math.max(0, loch.left), height: loch.height }} />
          <div className="tour__sperre" style={{ top: loch.top, left: loch.left + loch.width, right: 0, height: loch.height }} />
          {/* Bei reinen Info-Schritten ist auch das Element selbst nicht antippbar */}
          <div className={`tour__rahmen ${schritt.tippen ? 'tour__rahmen--tippen' : 'tour__rahmen--info'}`} style={loch} />
        </>
      ) : (
        <div className="tour__sperre" style={{ inset: 0 }} />
      )}

      <div className="tour__box" style={boxStil}>
        <small>Schritt {index + 1} von {TOUR_SCHRITTE.length}</small>
        <h3>{schritt.titel}</h3>
        <p>{wartetAufZiel ? 'Einen Moment …' : schritt.text}</p>
        <div className="tour__knoepfe">
          <button type="button" className="btn" onClick={beenden}>{letzter ? 'Schließen' : 'Tour beenden'}</button>
          {schritt.tippen && !wartetAufZiel ? (
            <span className="tour__tipp">👆 Tippe auf das Hervorgehobene</span>
          ) : (
            <button type="button" className="btn btn--primary" onClick={weiter} autoFocus>{letzter ? 'Los geht’s!' : 'Weiter'}</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
