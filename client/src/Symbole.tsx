// Schlichte Linien-Symbole (16 px, Farbe = Textfarbe) für Kopfzeile und Anmeldung – ruhiger als Emojis
import type { ReactNode } from 'react';

export type SymbolName = 'geld' | 'stern' | 'wetter' | 'funk' | 'einsatz' | 'wache' | 'krankenhaus' | 'karte' | 'einstellungen';

const PFADE: Record<SymbolName, ReactNode> = {
  geld: (
    <>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M11 8h1.5" />
      <path d="M1.5 6h13" />
    </>
  ),
  stern: <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />,
  wetter: (
    <>
      <path d="M4.5 12.5h7a2.5 2.5 0 0 0 .3-5A3.5 3.5 0 0 0 5 6.6a3 3 0 0 0-.5 5.9z" />
    </>
  ),
  funk: (
    <>
      <rect x="3.5" y="5.5" width="9" height="9" rx="1.5" />
      <path d="M5.5 5.5L11 1.5" />
      <path d="M6 9h4M6 11.5h4" />
    </>
  ),
  einsatz: (
    <>
      <path d="M8 1.5L14.5 13H1.5z" />
      <path d="M8 6v3.2M8 11.2v.1" />
    </>
  ),
  wache: (
    <>
      <path d="M2 7l6-4.5L14 7" />
      <path d="M3.5 6v8h9V6" />
      <path d="M6.5 14v-4h3v4" />
    </>
  ),
  krankenhaus: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M8 5v6M5 8h6" />
    </>
  ),
  einstellungen: (
    <>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
      <circle cx="5.5" cy="4" r="1.6" fill="var(--color-surface)" />
      <circle cx="10.5" cy="8" r="1.6" fill="var(--color-surface)" />
      <circle cx="7" cy="12" r="1.6" fill="var(--color-surface)" />
    </>
  ),
  karte: (
    <>
      <path d="M8 14.5s4.5-4.2 4.5-8a4.5 4.5 0 0 0-9 0c0 3.8 4.5 8 4.5 8z" />
      <circle cx="8" cy="6.5" r="1.6" />
    </>
  ),
};

export function Piktogramm({ name, groesse = 16 }: { name: SymbolName; groesse?: number }) {
  return (
    <svg
      className="symbol"
      width={groesse}
      height={groesse}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PFADE[name]}
    </svg>
  );
}

/** Wort-Bild-Marke: Signet (EKG-Linie im Quadrat) und Schriftzug */
export function Marke({ untertitel }: { untertitel?: string }) {
  return (
    <span className="marke">
      <svg className="marke__signet" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
        <path d="M5 17h6l2.5-6 4 11 3-7.5 1.5 2.5H27" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="marke__text">
        <strong>Leitstellen<span>Dispo</span></strong>
        {untertitel && <small>{untertitel}</small>}
      </span>
    </span>
  );
}
