import { useEffect, useState } from 'react';
import type { Ankuendigung } from '@leitstellendispo/shared';
import { ANKUENDIGUNG_GEAENDERT, ladeAnkuendigung } from './konto';
import Fenster from './Fenster';

const AUSGEBLENDET_KEY = 'leitstellendispo.ankuendigung-ausgeblendet';
/** Ankündigungen mit „Als Fenster“ erscheinen einmal in der Mitte, danach nur noch als Banner oben */
const FENSTER_GESEHEN_KEY = 'leitstellendispo.ankuendigung-fenster-gesehen';
const NEU_LADEN_MS = 15 * 1000; // kurz, damit z. B. „Neustart in 1 Minute“ rechtzeitig ankommt

const SYMBOL: Record<Ankuendigung['art'], string> = { info: 'i', wartung: '!', wichtig: '⚠' };

const TITEL: Record<Ankuendigung['art'], string> = { info: '📢 Neuigkeiten', wartung: '🔧 Wartung', wichtig: '⚠️ Wichtig' };

const gespeichertFuer = (key: string, ankuendigung: Ankuendigung) => {
  try {
    return localStorage.getItem(key) === ankuendigung.zeit;
  } catch {
    return false;
  }
};
const merke = (key: string, ankuendigung: Ankuendigung) => {
  try {
    localStorage.setItem(key, ankuendigung.zeit);
  } catch {
    // Dann nur bis zum Neuladen gemerkt
  }
};

/** Hinweis des Teams an alle Spieler – lässt sich wegklicken, eine neue Ankündigung erscheint wieder. */
export default function AnkuendigungsBanner() {
  const [ankuendigung, setAnkuendigung] = useState<Ankuendigung | null>(null);
  const [ausgeblendet, setAusgeblendet] = useState(false);
  const [fensterOffen, setFensterOffen] = useState(false);

  useEffect(() => {
    let aktiv = true;
    const laden = () => ladeAnkuendigung().then((neu) => {
      if (!aktiv) return;
      setAnkuendigung(neu);
      setAusgeblendet(neu ? gespeichertFuer(AUSGEBLENDET_KEY, neu) : false);
      setFensterOffen(neu ? neu.fenster && !gespeichertFuer(FENSTER_GESEHEN_KEY, neu) && !gespeichertFuer(AUSGEBLENDET_KEY, neu) : false);
    });
    void laden();
    const interval = setInterval(() => void laden(), NEU_LADEN_MS);
    // Sofort nachladen: Team hat sie gerade geändert, oder der Tab war im Hintergrund (Browser bremsen dort die Abfrage)
    const sofort = () => void laden();
    const beiSichtbar = () => { if (document.visibilityState === 'visible') sofort(); };
    window.addEventListener(ANKUENDIGUNG_GEAENDERT, sofort);
    window.addEventListener('online', sofort);
    document.addEventListener('visibilitychange', beiSichtbar);
    return () => {
      aktiv = false;
      clearInterval(interval);
      window.removeEventListener(ANKUENDIGUNG_GEAENDERT, sofort);
      window.removeEventListener('online', sofort);
      document.removeEventListener('visibilitychange', beiSichtbar);
    };
  }, []);

  if (!ankuendigung || ausgeblendet) return null;

  const ausblenden = () => {
    merke(AUSGEBLENDET_KEY, ankuendigung);
    setAusgeblendet(true);
  };
  const fensterSchliessen = () => {
    merke(FENSTER_GESEHEN_KEY, ankuendigung);
    setFensterOffen(false);
  };

  if (fensterOffen) {
    return (
      <Fenster titel={TITEL[ankuendigung.art]} label="Ankündigung" onClose={fensterSchliessen}>
        <p style={{ whiteSpace: 'pre-wrap' }}>{ankuendigung.text}</p>
        <button type="button" className="btn btn--primary" onClick={fensterSchliessen} autoFocus>Alles klar</button>
      </Fenster>
    );
  }

  return (
    <div className={`ankuendigung ankuendigung--${ankuendigung.art}`} role="status">
      <span aria-hidden>{SYMBOL[ankuendigung.art]}</span>
      <p>{ankuendigung.text}</p>
      <button type="button" className="ankuendigung__schliessen" onClick={ausblenden} aria-label="Ankündigung ausblenden">✕</button>
    </div>
  );
}
