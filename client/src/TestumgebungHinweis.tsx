/** Läuft das Spiel auf der Testumgebung (test.leitstellendispo.de)? */
export const istTestumgebung = () => window.location.hostname.startsWith('test.');

/** Großer Hinweis ganz oben auf der Testumgebung – lässt sich bewusst nicht wegklicken. */
export default function TestumgebungHinweis() {
  if (!istTestumgebung()) return null;
  return (
    <div className="testumgebung-hinweis" role="alert">
      <strong>⚠ Testumgebung</strong>
      <span>
        Hier werden neue Funktionen ausprobiert – Fehler und gelöschte Spielstände sind möglich.
        Das richtige Spiel findest du unter{' '}
        <a href="https://spiel.leitstellendispo.de">spiel.leitstellendispo.de</a>.
      </span>
    </div>
  );
}
