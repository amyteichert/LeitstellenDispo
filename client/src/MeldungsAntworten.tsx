import { useEffect, useState } from 'react';
import type { MeldungsAntwort } from '@leitstellendispo/shared';
import { ladeMeldungsAntworten, markiereMeldungsAntwortenGesehen } from './konto';

const NEU_LADEN_MS = 5 * 60 * 1000;

/** Hinweis an den Spieler: Das Team hat seine Meldung erledigt (ggf. mit Antwort). Verschwindet nach „Danke“. */
export default function MeldungsAntworten() {
  const [antworten, setAntworten] = useState<MeldungsAntwort[]>([]);

  useEffect(() => {
    let aktiv = true;
    const laden = () => ladeMeldungsAntworten().then((neu) => { if (aktiv) setAntworten(neu); });
    void laden();
    const interval = setInterval(() => void laden(), NEU_LADEN_MS);
    return () => {
      aktiv = false;
      clearInterval(interval);
    };
  }, []);

  if (antworten.length === 0) return null;

  const gesehen = (id: number) => {
    setAntworten((liste) => liste.filter((a) => a.id !== id));
    void markiereMeldungsAntwortenGesehen([id]);
  };

  return (
    <>
      {antworten.map((a) => (
        <div key={a.id} className="ankuendigung ankuendigung--erledigt" role="status">
          <span aria-hidden>✓</span>
          <p>
            <strong>Deine Meldung wurde erledigt:</strong> „{a.text}“
            {a.antwort && <><br />Antwort vom Team: {a.antwort}</>}
          </p>
          <button type="button" className="btn btn--klein" onClick={() => gesehen(a.id)}>Danke</button>
        </div>
      ))}
    </>
  );
}
