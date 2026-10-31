/** Läuft das Spiel auf der Testumgebung (test.leitstellendispo.de)? */
export const istTestumgebung = () => window.location.hostname.startsWith('test.');

function Balken({ platzhalter = false }: { platzhalter?: boolean }) {
  return (
    <div
      className={`testumgebung-hinweis${platzhalter ? ' testumgebung-hinweis--platzhalter' : ''}`}
      role={platzhalter ? undefined : 'alert'}
      aria-hidden={platzhalter || undefined}
    >
      <strong>⚠ Testumgebung</strong>
      <span className="testumgebung-hinweis__lang">
        Hier werden neue Funktionen ausprobiert – Fehler und gelöschte Spielstände sind möglich.
        Das richtige Spiel findest du unter{' '}
        <a href="https://spiel.leitstellendispo.de" tabIndex={platzhalter ? -1 : undefined}>spiel.leitstellendispo.de</a>.
      </span>
      <span className="testumgebung-hinweis__kurz">
        Richtiges Spiel: <a href="https://spiel.leitstellendispo.de" tabIndex={platzhalter ? -1 : undefined}>spiel.leitstellendispo.de</a>
      </span>
    </div>
  );
}

/**
 * Großer Hinweis auf der Testumgebung – bleibt beim Scrollen oben stehen und lässt sich bewusst nicht wegklicken.
 * Der unsichtbare Platzhalter ist genauso hoch wie der feste Balken, damit nichts darunter verschwindet.
 */
export default function TestumgebungHinweis() {
  if (!istTestumgebung()) return null;
  return (
    <>
      <Balken />
      <Balken platzhalter />
    </>
  );
}
