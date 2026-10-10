import { useEffect } from 'react';
import { WETTER_INFO, WETTER_LABELS, WETTER_MENGE, type Wetter } from '@leitstellendispo/shared';

/** Kurzinfo zum aktuellen Wetter: Was bedeutet es für das Einsatzaufkommen? */
export default function WetterFenster({ wetter, onClose }: { wetter: Wetter; onClose: () => void }) {
  useEffect(() => {
    const beiEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', beiEscape);
    return () => window.removeEventListener('keydown', beiEscape);
  }, [onClose]);

  const mehr = Math.round((WETTER_MENGE[wetter] - 1) * 100);

  return (
    <div className="ruf-fenster__hintergrund" onClick={onClose}>
      <div className="ruf-fenster" role="dialog" aria-modal="true" aria-label="Wetter" onClick={(event) => event.stopPropagation()}>
        <div className="ruf-fenster__kopf">
          <h3>{WETTER_LABELS[wetter]}</h3>
          <button type="button" className="btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        <p className="ruf-fenster__info">
          {WETTER_INFO[wetter]}
          {mehr > 0 && <> Insgesamt kommen etwa <strong>{mehr} % mehr Einsätze</strong> rein.</>}
        </p>
        <p className="ruf-fenster__info">
          Das ist das echte Wetter an deiner ersten Wache – es wird alle 30 Minuten aktualisiert.
        </p>
      </div>
    </div>
  );
}
