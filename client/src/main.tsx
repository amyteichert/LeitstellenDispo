import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Anmeldung from './Anmeldung';
import Rechtliches, { istRechtlicheSeite } from './Rechtliches';
import './index.css';

const pfad = window.location.pathname;

createRoot(document.getElementById('root')!).render(
  // Impressum und Datenschutz müssen ohne Anmeldung erreichbar sein
  istRechtlicheSeite(pfad) ? (
    <StrictMode>
      <Rechtliches pfad={pfad} />
    </StrictMode>
  ) : (
  <StrictMode>
    <Anmeldung>
      {/* key: Beim Kontowechsel startet das Spiel komplett neu mit dem Stand des neuen Kontos */}
      {(konto, onAbmelden) => <App key={konto.id} konto={konto} onAbmelden={onAbmelden} />}
    </Anmeldung>
  </StrictMode>
  ),
);
