import { useEffect, useState } from 'react';
import { SPIELSTAND_KONFLIKT } from './konto';

/**
 * Hinweis, wenn derselbe Spielstand auf einem anderen Gerät (oder in einem anderen Tab) weitergespielt wurde.
 * Dieses Gerät speichert dann nicht mehr – sonst würde es die Änderungen des anderen Geräts überschreiben.
 * Der Spieler lädt neu und spielt mit dem aktuellen Stand weiter.
 */
export default function SpielstandKonflikt() {
  const [sichtbar, setSichtbar] = useState(false);

  useEffect(() => {
    const beiKonflikt = () => setSichtbar(true);
    window.addEventListener(SPIELSTAND_KONFLIKT, beiKonflikt);
    return () => window.removeEventListener(SPIELSTAND_KONFLIKT, beiKonflikt);
  }, []);

  if (!sichtbar) return null;

  return (
    <div className="ruf-fenster__hintergrund" role="alertdialog" aria-labelledby="konflikt-titel">
      <div className="ruf-fenster">
        <div className="ruf-fenster__kopf">
          <h3 id="konflikt-titel">Auf einem anderen Gerät weitergespielt</h3>
        </div>
        <p>
          Deine Leitstelle läuft gerade noch woanders – in einem anderen Tab, auf dem Handy oder auf einem zweiten Rechner.
          Dort ist dein Spielstand neuer als hier.
        </p>
        <p>
          <strong>Dieses Fenster speichert nichts mehr</strong>, damit dein Fortschritt vom anderen Gerät nicht verloren geht.
          Lade neu, um hier mit dem aktuellen Stand weiterzuspielen.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Neu laden
          </button>
          <button type="button" className="btn" onClick={() => setSichtbar(false)}>
            Nur ansehen (nicht weiterspielen)
          </button>
        </div>
      </div>
    </div>
  );
}
