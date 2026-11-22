import { useEffect, useState } from 'react';
import { ladeOnlineAnzahl } from './konto';

const NEU_LADEN_MS = 30 * 1000;

/** Anzahl der Spieler, die gerade online sind – wird nur geladen, solange `aktiv` (z. B. Menü offen) */
export function useOnlineAnzahl(aktiv: boolean): number | null {
  const [anzahl, setAnzahl] = useState<number | null>(null);

  useEffect(() => {
    if (!aktiv) return;
    let laeuft = true;
    const laden = () => ladeOnlineAnzahl().then((n) => { if (laeuft && n !== null) setAnzahl(n); });
    void laden();
    const interval = setInterval(() => void laden(), NEU_LADEN_MS);
    return () => {
      laeuft = false;
      clearInterval(interval);
    };
  }, [aktiv]);

  return anzahl;
}

/** „Gerade 3 Leute in der Leitstelle“ */
export const onlineText = (anzahl: number) => `Gerade ${anzahl} ${anzahl === 1 ? 'Person' : 'Leute'} in der Leitstelle`;
