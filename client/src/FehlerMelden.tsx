import { useState, type FormEvent } from 'react';
import { APP_VERSION, FEHLERMELDUNG_MAX_LAENGE } from '@leitstellendispo/shared';
import { KontoFehler, sendeFehlermeldung } from './konto';

/** Fenster „Fehler melden“: Beschreibung des Spielers, Version, Ansicht und Gerät gehen automatisch mit */
export default function FehlerMelden({ ansicht, onClose }: { ansicht: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'bereit' | 'sendet' | 'gesendet'>('bereit');
  const [fehler, setFehler] = useState<string | null>(null);

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sendet');
    setFehler(null);
    try {
      await sendeFehlermeldung(text, {
        version: APP_VERSION,
        ansicht,
        geraet: navigator.userAgent,
        bildschirm: `${window.innerWidth}x${window.innerHeight}`,
      });
      setStatus('gesendet');
    } catch (error) {
      setFehler(error instanceof KontoFehler ? error.message : 'Die Meldung konnte nicht gesendet werden.');
      setStatus('bereit');
    }
  };

  return (
    <div className="ruf-fenster__hintergrund" onClick={onClose}>
      <div className="ruf-fenster" role="dialog" aria-label="Fehler melden" onClick={(e) => e.stopPropagation()}>
        <div className="ruf-fenster__kopf">
          <h3>Fehler melden</h3>
          <button type="button" className="btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {status === 'gesendet' ? (
          <>
            <p>Danke! Deine Meldung ist beim Team angekommen.</p>
            <button type="button" className="btn btn--primary" onClick={onClose}>Schließen</button>
          </>
        ) : (
          <form className="fehler-melden" onSubmit={absenden}>
            <label htmlFor="fehler-text">Was ist passiert? Was hast du davor gemacht?</label>
            <textarea
              id="fehler-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={FEHLERMELDUNG_MAX_LAENGE}
              rows={6}
              placeholder="z. B. Der RTW bleibt nach dem Transport am Krankenhaus stehen und kommt nicht zurück."
              autoFocus
            />
            <small className="einsatz-eintrag__zeile">
              Automatisch dabei: Spielversion, aktuelle Ansicht, Gerät/Browser, Bildschirmgröße und ein Überblick über deinen Spielstand.
            </small>
            {fehler && <p className="versorgung-hinweis versorgung-hinweis--fehlt" role="alert">{fehler}</p>}
            <button type="submit" className="btn btn--primary" disabled={status === 'sendet' || text.trim().length < 5}>
              {status === 'sendet' ? 'Wird gesendet …' : 'Meldung senden'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
