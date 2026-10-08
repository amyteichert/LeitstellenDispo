import { useState } from 'react';
import { ermittleErsteSchritte, type ErsteSchritteStand } from '@leitstellendispo/shared';

type Anzeige = 'offen' | 'zu' | 'aus';

/** Anzeige-Zustand pro Konto und Gerät merken */
function speicherKey(kontoId: number) {
  return `leitstellendispo.erste-schritte.${kontoId}`;
}

function ladeAnzeige(kontoId: number): Anzeige {
  try {
    const wert = localStorage.getItem(speicherKey(kontoId));
    return wert === 'zu' || wert === 'aus' ? wert : 'offen';
  } catch {
    return 'offen';
  }
}

/** Schwebende Checkliste für neue Spieler. Der Fortschritt ergibt sich aus dem Spielstand. */
export default function ErsteSchritte({ kontoId, stand }: { kontoId: number; stand: ErsteSchritteStand }) {
  const [anzeige, setAnzeigeState] = useState<Anzeige>(() => ladeAnzeige(kontoId));
  const setAnzeige = (neu: Anzeige) => {
    setAnzeigeState(neu);
    try {
      localStorage.setItem(speicherKey(kontoId), neu);
    } catch {
      // ohne Browser-Speicher gilt die Auswahl nur bis zum Neuladen
    }
  };

  if (anzeige === 'aus') return null;

  const schritte = ermittleErsteSchritte(stand);
  const erledigt = schritte.filter((schritt) => schritt.erledigt).length;
  const alleErledigt = erledigt === schritte.length;
  const naechster = schritte.find((schritt) => !schritt.erledigt);

  if (anzeige === 'zu') {
    return (
      <button type="button" className="erste-schritte erste-schritte--zu" onClick={() => setAnzeige('offen')}>
        🎓 Erste Schritte {erledigt}/{schritte.length}
      </button>
    );
  }

  return (
    <section className="erste-schritte" aria-label="Erste Schritte">
      <header className="erste-schritte__kopf">
        <strong>🎓 Erste Schritte</strong>
        <span>{erledigt}/{schritte.length}</span>
        <button type="button" onClick={() => setAnzeige('zu')} aria-label="Einklappen" title="Einklappen">▾</button>
      </header>

      {alleErledigt ? (
        <p className="erste-schritte__fertig">Geschafft! 🎉 Du kennst jetzt die Grundlagen. Viel Erfolg in deiner Leitstelle!</p>
      ) : (
        <ol className="erste-schritte__liste">
          {schritte.map((schritt) => (
            <li key={schritt.id} className={schritt.erledigt ? 'erledigt' : schritt === naechster ? 'aktuell' : undefined}>
              <span aria-hidden>{schritt.erledigt ? '✅' : '⬜'}</span>
              <div>
                <strong>{schritt.titel}</strong>
                {/* Nur beim nächsten offenen Schritt die Anleitung zeigen – sonst wird es zu viel Text */}
                {schritt === naechster && <small>{schritt.anleitung}</small>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <button type="button" className="erste-schritte__aus" onClick={() => setAnzeige('aus')}>
        {alleErledigt ? 'Schließen' : 'Nicht mehr anzeigen'}
      </button>
    </section>
  );
}
