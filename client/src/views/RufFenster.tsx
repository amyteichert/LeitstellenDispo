import { useEffect, useMemo, useState } from 'react';
import {
  RUF_CONFIG,
  formatEinsatzTitel,
  getBewertungsHinweise,
  getRufLabel,
  type AbgeschlossenerSpielEinsatz,
} from '@leitstellendispo/shared';

const ANZAHL = 30;

/** Ruf der Leitstelle mit Fehlerübersicht: Was lief bei den letzten Einsätzen schief? */
export default function RufFenster({
  ruf,
  completedIncidentHistory,
  onClose,
  onEinsatzOeffnen,
}: {
  ruf: number;
  completedIncidentHistory: AbgeschlossenerSpielEinsatz[];
  onClose: () => void;
  onEinsatzOeffnen: (einsatzId: string) => void;
}) {
  const [nurFehler, setNurFehler] = useState(true);

  useEffect(() => {
    const beiEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', beiEscape);
    return () => window.removeEventListener('keydown', beiEscape);
  }, [onClose]);

  const bewertet = useMemo(
    () => completedIncidentHistory
      .filter((einsatz) => einsatz.bewertung)
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, ANZAHL)
      .map((einsatz) => ({ einsatz, hinweise: getBewertungsHinweise(einsatz.bewertung!) })),
    [completedIncidentHistory],
  );
  const mitFehlern = bewertet.filter((eintrag) => eintrag.hinweise.some((h) => h.art === 'fehler'));
  const liste = nurFehler ? mitFehlern : bewertet;
  const schnitt = bewertet.length > 0
    ? Math.round(bewertet.reduce((summe, { einsatz }) => summe + einsatz.bewertung!.punkte, 0) / bewertet.length)
    : null;

  return (
    <div className="ruf-fenster__hintergrund" onClick={onClose}>
      <div className="ruf-fenster" role="dialog" aria-modal="true" aria-label="Ruf der Leitstelle" onClick={(event) => event.stopPropagation()}>
        <div className="ruf-fenster__kopf">
          <h3>⭐ Ruf {ruf} · {getRufLabel(ruf)}</h3>
          <button type="button" className="btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        <div className="ruf-fenster__balken" aria-hidden>
          <span style={{ width: `${(ruf / RUF_CONFIG.max) * 100}%` }} />
        </div>
        <p className="ruf-fenster__info">
          Grundgeld gibt es immer. Gute Arbeit bringt einen Leistungsbonus – je besser der Ruf, desto höher.
          Bewertet werden <strong>Fahrzeugwahl</strong> (nächstes freies Fahrzeug geschickt?) und <strong>Hilfsfrist</strong> (wie schnell war das erste Fahrzeug da?).
          {schnitt !== null && <> Durchschnitt der letzten {bewertet.length} Einsätze: <strong>{schnitt} / 100 Punkte</strong>.</>}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" className={`btn ${nurFehler ? 'btn--primary' : ''}`} onClick={() => setNurFehler(true)}>
            Fehler ({mitFehlern.length})
          </button>
          <button type="button" className={`btn ${!nurFehler ? 'btn--primary' : ''}`} onClick={() => setNurFehler(false)}>
            Alle ({bewertet.length})
          </button>
        </div>

        {liste.length === 0 ? (
          <div className="leerzustand">
            <strong>{nurFehler ? 'Keine Fehler – weiter so!' : 'Noch keine bewerteten Einsätze'}</strong>
            {nurFehler ? 'Bei deinen letzten Einsätzen lief alles nach Plan.' : 'Nach dem ersten abgeschlossenen Einsatz siehst du hier deine Bewertung.'}
          </div>
        ) : (
          <ul className="ruf-fenster__liste">
            {liste.map(({ einsatz, hinweise }) => {
              const b = einsatz.bewertung!;
              return (
                <li key={einsatz.id}>
                  <button type="button" className="ruf-eintrag" onClick={() => onEinsatzOeffnen(einsatz.id)}>
                    <span className="ruf-eintrag__kopf">
                      <strong>{formatEinsatzTitel(einsatz)}</strong>
                      <span className={b.rufAenderung < 0 ? 'ruf-minus' : b.rufAenderung > 0 ? 'ruf-plus' : ''}>
                        {b.punkte} Pkt · Ruf {b.rufAenderung > 0 ? '+' : ''}{b.rufAenderung}
                      </span>
                    </span>
                    <small>📍 {einsatz.address} · {new Date(einsatz.completedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
                    <ul>
                      {hinweise.map((hinweis) => (
                        <li key={hinweis.text} className={`ruf-hinweis ruf-hinweis--${hinweis.art}`}>
                          {hinweis.art === 'fehler' ? '✗' : '✓'} {hinweis.text}
                        </li>
                      ))}
                    </ul>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
