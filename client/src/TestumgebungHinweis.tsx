import { useEffect, useRef, type Ref } from 'react';

/** Läuft das Spiel auf der Testumgebung (test.leitstellendispo.de)? */
export const istTestumgebung = () => window.location.hostname.startsWith('test.');

function Balken({ platzhalter = false, balkenRef }: { platzhalter?: boolean; balkenRef?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={balkenRef}
      className={`testumgebung-hinweis${platzhalter ? ' testumgebung-hinweis--platzhalter' : ''}`}
      role={platzhalter ? undefined : 'alert'}
      aria-hidden={platzhalter || undefined}
    >
      <strong>⚠ Testumgebung</strong>
      <span className="testumgebung-hinweis__lang">
        Neue Konten müssen vom Team freigeschaltet werden, nicht freigeschaltete Konten werden nach 7 Tagen gelöscht.
        Das richtige Spiel findest du unter{' '}
        <a href="https://spiel.leitstellendispo.de" tabIndex={platzhalter ? -1 : undefined}>spiel.leitstellendispo.de</a>.
      </span>
      <span className="testumgebung-hinweis__kurz">
        Nicht freigeschaltete Konten werden nach 7 Tagen gelöscht. Richtiges Spiel: <a href="https://spiel.leitstellendispo.de" tabIndex={platzhalter ? -1 : undefined}>spiel.leitstellendispo.de</a>
      </span>
    </div>
  );
}

/**
 * Großer Hinweis auf der Testumgebung – bleibt beim Scrollen oben stehen und lässt sich bewusst nicht wegklicken.
 * Der unsichtbare Platzhalter ist genauso hoch wie der feste Balken, damit nichts darunter verschwindet.
 */
export default function TestumgebungHinweis() {
  const balkenRef = useRef<HTMLDivElement>(null);

  // Hervorgehobenes (z. B. in der Tour) nie unter den festen Balken scrollen
  useEffect(() => {
    const balken = balkenRef.current;
    if (!balken || typeof ResizeObserver === 'undefined') return;
    const setzeAbstand = () => {
      document.documentElement.style.scrollPaddingTop = `${balken.offsetHeight}px`;
      // Auch für feste Elemente nutzbar (z. B. der Tour-Hinweis, der sonst unter dem Balken liegt)
      document.documentElement.style.setProperty('--fester-balken', `${balken.offsetHeight}px`);
    };
    setzeAbstand();
    const beobachter = new ResizeObserver(setzeAbstand);
    beobachter.observe(balken);
    return () => {
      beobachter.disconnect();
      document.documentElement.style.scrollPaddingTop = '';
      document.documentElement.style.removeProperty('--fester-balken');
    };
  }, []);

  if (!istTestumgebung()) return null;
  return (
    <>
      <Balken balkenRef={balkenRef} />
      <Balken platzhalter />
    </>
  );
}
