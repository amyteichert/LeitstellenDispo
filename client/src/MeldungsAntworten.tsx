import { useEffect, useState } from 'react';
import type { MeldungsAntwort } from '@leitstellendispo/shared';
import { ladeMeldungsAntworten, markiereMeldungsAntwortenGesehen } from './konto';

const NEU_LADEN_MS = 60 * 1000;

const GELESEN_TEXT = {
  umsetzen: 'Das Team hat deine Meldung gelesen und setzt sie demnächst um:',
  anschauen: 'Das Team hat deine Meldung gelesen und schaut sie sich demnächst an:',
} as const;

/** Hinweis an den Spieler: Das Team hat seine Meldung gelesen oder erledigt (ggf. mit Antwort). Verschwindet nach „Danke“/„OK“. */
export default function MeldungsAntworten() {
  const [antworten, setAntworten] = useState<MeldungsAntwort[]>([]);

  useEffect(() => {
    let aktiv = true;
    const laden = () => ladeMeldungsAntworten().then((neu) => { if (aktiv) setAntworten(neu); });
    void laden();
    const interval = setInterval(() => void laden(), NEU_LADEN_MS);
    const beiSichtbar = () => { if (document.visibilityState === 'visible') void laden(); };
    document.addEventListener('visibilitychange', beiSichtbar);
    return () => {
      aktiv = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', beiSichtbar);
    };
  }, []);

  if (antworten.length === 0) return null;

  // Alle offenen Hinweise in einem Fenster in der Mitte – „OK“ markiert sie als gesehen
  const schliessen = () => {
    void markiereMeldungsAntwortenGesehen(antworten.map((a) => a.id));
    setAntworten([]);
  };

  return (
    <div className="ruf-fenster__hintergrund" onClick={schliessen}>
      <div className="ruf-fenster" role="dialog" aria-label="Antwort auf deine Meldung" onClick={(e) => e.stopPropagation()}>
        <div className="ruf-fenster__kopf">
          <h3>{antworten.length === 1 ? 'Neues zu deiner Meldung' : 'Neues zu deinen Meldungen'}</h3>
          <button type="button" className="btn" onClick={schliessen} aria-label="Schließen">✕</button>
        </div>
        {antworten.map((a) => (
          <div key={a.id} className={a.art === 'erledigt' ? 'ankuendigung ankuendigung--erledigt' : 'ankuendigung'}>
            <span aria-hidden>{a.art === 'erledigt' ? '✓' : '👀'}</span>
            <p>
              <strong>{a.art === 'erledigt' ? 'Deine Meldung wurde erledigt:' : GELESEN_TEXT[a.gelesen ?? 'anschauen']}</strong> „{a.text}“
              {a.art === 'erledigt' && a.antwort && <><br />Antwort vom Team: {a.antwort}</>}
            </p>
          </div>
        ))}
        <button type="button" className="btn btn--primary" onClick={schliessen} autoFocus>Danke!</button>
      </div>
    </div>
  );
}
