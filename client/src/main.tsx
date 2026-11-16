import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Fehlergrenze from './Fehlergrenze';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fehlergrenze>
      <App />
    </Fehlergrenze>
  </StrictMode>,
);
