import { useEffect, useState } from 'react';

/** Grenze wie im CSS: darunter stehen Liste und Details untereinander (Handy, Tablet hochkant) */
const SCHMAL = '(max-width: 900px)';

/** true auf schmalen Bildschirmen – reagiert auch auf Drehen und Fenstergröße */
export function useIstSchmal(): boolean {
  const [schmal, setSchmal] = useState(() => window.matchMedia(SCHMAL).matches);
  useEffect(() => {
    const abfrage = window.matchMedia(SCHMAL);
    const aendern = () => setSchmal(abfrage.matches);
    abfrage.addEventListener('change', aendern);
    return () => abfrage.removeEventListener('change', aendern);
  }, []);
  return schmal;
}
