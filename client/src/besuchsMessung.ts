/**
 * Anonyme Besucherstatistik des Spiels (Gegenstück zum Skript der Info-Website): Aufruf, Herkunft, aktive Zeit,
 * Klicks und erreichtes Ziel (registriert, angemeldet, gespielt). Keine Cookies, nichts im Browser gespeichert.
 * Auswertung im Team-Bereich → „Website“.
 */
import type { BesuchsZiel } from '@leitstellendispo/shared';

const API = '/api/website';
/** Wichtigeres Ziel überschreibt unwichtigeres */
const ZIEL_RANG: Partial<Record<BesuchsZiel, number>> = { gespielt: 1, angemeldet: 2, registriert: 3 };

let ziel: BesuchsZiel | null = null;

/** Merkt ein erreichtes Ziel für den aktuellen Besuch (z. B. nach der Registrierung). */
export function merkeBesuchsZiel(neu: BesuchsZiel) {
  if (!ziel || (ZIEL_RANG[neu] ?? 0) > (ZIEL_RANG[ziel] ?? 0)) ziel = neu;
}

const senden = (pfad: string, daten: object) => {
  const text = JSON.stringify(daten);
  try {
    if (navigator.sendBeacon?.(API + pfad, new Blob([text], { type: 'text/plain' }))) return;
    void fetch(API + pfad, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: text }).catch(() => undefined);
  } catch {
    // Statistik darf das Spiel nie stören
  }
};

/** Startet die Messung für diesen Seitenaufruf – nur auf der echten Domain, nicht bei der Entwicklung. */
export function starteBesuchsMessung() {
  if (!/(^|\.)leitstellendispo\.de$/.test(window.location.hostname)) return;

  const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
  senden('/aufruf', {
    id,
    bereich: 'spiel',
    seite: window.location.pathname.replace(/\/+$/, '') || '/',
    referrer: document.referrer,
    von: new URLSearchParams(window.location.search).get('von'),
  });

  let aktivSeit: number | null = document.visibilityState === 'visible' ? Date.now() : null;
  let aktivMs = 0;
  let interaktion = false;
  document.addEventListener('click', () => { interaktion = true; }, true);

  const ende = () => {
    if (aktivSeit !== null) {
      aktivMs += Date.now() - aktivSeit;
      aktivSeit = null;
    }
    // Scrollen ist im Spiel wenig aussagekräftig – „gelesen“ ergibt sich hier aus der Zeit
    senden('/ende', { id, dauer: Math.round(aktivMs / 1000), scroll: 0, interaktion, ziel });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') ende();
    else aktivSeit = Date.now();
  });
  window.addEventListener('pagehide', ende);
}
