import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Anmeldung from './Anmeldung';
import PasswortZuruecksetzen, { PASSWORT_SEITE } from './PasswortZuruecksetzen';
import Rechtliches, { istRechtlicheSeite } from './Rechtliches';
import './index.css';

const pfad = window.location.pathname.replace(/\/+$/, '');

/** Seiten, die ohne Anmeldung erreichbar sein müssen */
function OeffentlicheSeite() {
  if (istRechtlicheSeite(pfad)) return <Rechtliches pfad={pfad} />;
  if (pfad === PASSWORT_SEITE) return <PasswortZuruecksetzen />;
  return null;
}

const oeffentlich = istRechtlicheSeite(pfad) || pfad === PASSWORT_SEITE;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {oeffentlich ? (
      <OeffentlicheSeite />
    ) : (
      <Anmeldung>
        {/* key: Beim Kontowechsel startet das Spiel komplett neu mit dem Stand des neuen Kontos */}
        {(konto, onAbmelden) => <App key={konto.id} konto={konto} onAbmelden={onAbmelden} />}
      </Anmeldung>
    )}
  </StrictMode>,
);
