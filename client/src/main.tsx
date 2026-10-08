import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Anmeldung from './Anmeldung';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Anmeldung>
      {/* key: Beim Kontowechsel startet das Spiel komplett neu mit dem Stand des neuen Kontos */}
      {(konto, onAbmelden) => <App key={konto.id} konto={konto} onAbmelden={onAbmelden} />}
    </Anmeldung>
  </StrictMode>,
);
