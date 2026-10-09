import { useEffect, useState } from 'react';
import type { Ankuendigung } from '@leitstellendispo/shared';
import { ladeAnkuendigung } from './konto';

const AUSGEBLENDET_KEY = 'leitstellendispo.ankuendigung-ausgeblendet';
const NEU_LADEN_MS = 2 * 60 * 1000;

const SYMBOL: Record<Ankuendigung['art'], string> = { info: 'ℹ️', wartung: '🛠️', wichtig: '⚠️' };

const istAusgeblendet = (ankuendigung: Ankuendigung) => {
  try {
    return localStorage.getItem(AUSGEBLENDET_KEY) === ankuendigung.zeit;
  } catch {
    return false;
  }
};

/** Hinweis des Teams an alle Spieler – lässt sich wegklicken, eine neue Ankündigung erscheint wieder. */
export default function AnkuendigungsBanner() {
  const [ankuendigung, setAnkuendigung] = useState<Ankuendigung | null>(null);
  const [ausgeblendet, setAusgeblendet] = useState(false);

  useEffect(() => {
    let aktiv = true;
    const laden = () => ladeAnkuendigung().then((neu) => {
      if (!aktiv) return;
      setAnkuendigung(neu);
      setAusgeblendet(neu ? istAusgeblendet(neu) : false);
    });
    void laden();
    const interval = setInterval(() => void laden(), NEU_LADEN_MS);
    return () => {
      aktiv = false;
      clearInterval(interval);
    };
  }, []);

  if (!ankuendigung || ausgeblendet) return null;

  const ausblenden = () => {
    try {
      localStorage.setItem(AUSGEBLENDET_KEY, ankuendigung.zeit);
    } catch {
      // Dann nur bis zum Neuladen ausgeblendet
    }
    setAusgeblendet(true);
  };

  return (
    <div className={`ankuendigung ankuendigung--${ankuendigung.art}`} role="status">
      <span aria-hidden>{SYMBOL[ankuendigung.art]}</span>
      <p>{ankuendigung.text}</p>
      <button type="button" className="ankuendigung__schliessen" onClick={ausblenden} aria-label="Ankündigung ausblenden">✕</button>
    </div>
  );
}
