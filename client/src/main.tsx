import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Anmeldung from './Anmeldung';
import PasswortZuruecksetzen, { PASSWORT_SEITE } from './PasswortZuruecksetzen';
import Rechtliches, { istRechtlicheSeite } from './Rechtliches';
import './index.css';
import './design.css';
import { richteTonFreischaltungEin } from './ton';
import { starteBesuchsMessung } from './besuchsMessung';
import TestumgebungHinweis, { istTestumgebung } from './TestumgebungHinweis';

// Handy-Browser erlauben Töne erst nach einer Berührung: die erste Berührung schaltet den Gong frei
richteTonFreischaltungEin();
// Anonyme Besucherstatistik (nur auf spiel.leitstellendispo.de)
starteBesuchsMessung();
// Auf der Testumgebung schon im Tab-Titel erkennbar
if (istTestumgebung()) document.title = `TEST – ${document.title}`;

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
    <TestumgebungHinweis />
    {oeffentlich ? (
      <OeffentlicheSeite />
    ) : (
      <Anmeldung>
        {/* key: Beim Kontowechsel startet das Spiel komplett neu mit dem Stand des neuen Kontos */}
        {(konto, onAbmelden, gast, setKonto) => <App key={konto.id} konto={konto} onAbmelden={onAbmelden} gast={gast} setKonto={setKonto} />}
      </Anmeldung>
    )}
  </StrictMode>,
);
