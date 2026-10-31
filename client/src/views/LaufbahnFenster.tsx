import { useEffect } from 'react';
import {
  ERFOLGE,
  RAENGE,
  getNaechsterRang,
  getRang,
  getRangFortschritt,
  type Laufbahn,
  type Rang,
} from '@leitstellendispo/shared';

const zahl = (wert: number) => wert.toLocaleString('de-DE');

const useEscape = (onClose: () => void) => {
  useEffect(() => {
    const beiEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', beiEscape);
    return () => window.removeEventListener('keydown', beiEscape);
  }, [onClose]);
};

/** Laufbahn: aktueller Rang, Fortschritt, was die Ränge freischalten und welche Erfolge es gibt */
export default function LaufbahnFenster({ laufbahn, onClose }: { laufbahn: Laufbahn; onClose: () => void }) {
  useEscape(onClose);
  const rang = getRang(laufbahn.xp);
  const naechster = getNaechsterRang(laufbahn.xp);
  const erreicht = new Set(laufbahn.erfolge);

  return (
    <div className="ruf-fenster__hintergrund" onClick={onClose}>
      <div className="ruf-fenster laufbahn-fenster" role="dialog" aria-modal="true" aria-label="Deine Laufbahn" onClick={(event) => event.stopPropagation()}>
        <div className="ruf-fenster__kopf">
          <h3>{rang.name} · Rang {rang.stufe}</h3>
          <button type="button" className="btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        <div className="ruf-fenster__balken" aria-hidden>
          <span style={{ width: `${getRangFortschritt(laufbahn.xp) * 100}%` }} />
        </div>
        <p className="ruf-fenster__info">
          <strong>{zahl(laufbahn.xp)} EP</strong>
          {naechster ? <> – noch {zahl(naechster.abXp - laufbahn.xp)} EP bis „{naechster.name}“.</> : ' – höchster Rang erreicht.'}
          {' '}Erfahrungspunkte gibt es für jeden abgeschlossenen Einsatz (mehr für große Einsätze und gute Arbeit) und für Erfolge.
        </p>

        <h4>Ränge</h4>
        <ol className="laufbahn-raenge">
          {RAENGE.map((eintrag) => (
            <li key={eintrag.stufe} className={eintrag.abXp <= laufbahn.xp ? 'laufbahn-raenge__erreicht' : undefined}>
              <span className="laufbahn-raenge__kopf">
                <strong>{eintrag.abXp <= laufbahn.xp ? '✓' : '🔒'} {eintrag.name}</strong>
                <small>ab {zahl(eintrag.abXp)} EP</small>
              </span>
              {eintrag.fahrzeuge.length > 0 && <small>Schaltet frei: {eintrag.fahrzeuge.join(', ')}</small>}
            </li>
          ))}
        </ol>

        <h4>Erfolge ({erreicht.size} von {ERFOLGE.length})</h4>
        <ul className="laufbahn-erfolge">
          {ERFOLGE.map((erfolg) => (
            <li key={erfolg.id} className={erreicht.has(erfolg.id) ? 'laufbahn-erfolge__erreicht' : undefined}>
              <span aria-hidden>{erreicht.has(erfolg.id) ? '🏅' : '○'}</span>
              <span>
                <strong>{erfolg.titel}</strong>
                <small>{erfolg.text} · +{zahl(erfolg.xp)} EP</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Glückwunsch beim Aufstieg – mit allem, was der neue Rang freischaltet */
export function BefoerderungFenster({ rang, onClose }: { rang: Rang; onClose: () => void }) {
  useEscape(onClose);
  return (
    <div className="ruf-fenster__hintergrund" onClick={onClose}>
      <div className="ruf-fenster befoerderung" role="dialog" aria-modal="true" aria-label="Beförderung" onClick={(event) => event.stopPropagation()}>
        <div className="befoerderung__abzeichen" aria-hidden>{rang.stufe}</div>
        <p className="befoerderung__titel">Befördert!</p>
        <h3>{rang.name}</h3>
        {rang.fahrzeuge.length > 0 ? (
          <p>Neu freigeschaltet: <strong>{rang.fahrzeuge.join(', ')}</strong></p>
        ) : (
          <p>Glückwunsch – du leitest jetzt deine eigene Leitstelle.</p>
        )}
        <button type="button" className="btn btn--primary" onClick={onClose}>Weiter geht’s</button>
      </div>
    </div>
  );
}
