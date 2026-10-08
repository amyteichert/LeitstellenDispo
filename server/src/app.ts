import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { FAHRZEUG_TYPEN, STANDARD_KRANKENHAEUSER, getAppInfo } from '@leitstellendispo/shared';
import type { Einsatz } from '@leitstellendispo/shared';
import { erstelleAuthRouter } from './auth.js';
import type { Datenbank } from './datenbank.js';
import { erstelleKontenDienst } from './konten.js';
import { erstelleSpielstandRouter } from './spielstand.js';
import { erstelleTeamRouter } from './team.js';

// Feste Beispieldaten für den ersten Durchstich – wird später durch echte Einsatzlogik ersetzt.
const beispielEinsaetze: Einsatz[] = [
  { id: 'E-001', stichwort: 'RD 1', meldebild: 'Internistischer Notfall', status: 'offen', address: 'Bahnhofstraße 12, 70173 Stuttgart' },
  { id: 'E-002', stichwort: 'B 2', meldebild: 'Zimmerbrand', status: 'alarmiert', address: 'Goethestraße 7, 70174 Stuttgart' },
  { id: 'E-003', stichwort: 'TH 1', meldebild: 'Ölspur', status: 'in_bearbeitung', address: 'Hauptstraße (Höhe Nr. 40), 70173 Stuttgart' },
];

/** Baut die Express-App. Getrennt vom Serverstart, damit Tests sie mit einer eigenen Datenbank nutzen können. */
export function erstelleApp(db: Datenbank, optionen: { bcryptRunden?: number } = {}) {
  const app = express();
  const konten = erstelleKontenDienst(db, optionen);

  // Hinter nginx (Cloudflare → nginx → Node): echte Client-IP aus X-Forwarded-For übernehmen,
  // sonst gilt die Fehlversuch-Bremse für alle Spieler gemeinsam. Nur dem lokalen Proxy vertrauen.
  app.set('trust proxy', 'loopback');

  app.use(cors());
  app.use(cookieParser());
  // Vor dem allgemeinen JSON-Parser einhängen: braucht ein größeres Limit für den Spielstand
  app.use('/api/spielstand', erstelleSpielstandRouter(db, konten));
  app.use(express.json());

  app.use('/api/auth', erstelleAuthRouter(konten));
  app.use('/api/team', erstelleTeamRouter(db, konten));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/info', (_req, res) => {
    res.json(getAppInfo());
  });

  app.get('/api/einsaetze', (_req, res) => {
    res.json(beispielEinsaetze);
  });

  // Zentraler Fahrzeugkatalog und Krankenhäuser – dieselben Daten wie im Spiel (aus shared)
  app.get('/api/fahrzeugtypen', (_req, res) => {
    res.json(FAHRZEUG_TYPEN);
  });

  app.get('/api/krankenhaeuser', (_req, res) => {
    res.json(STANDARD_KRANKENHAEUSER);
  });

  // Unerwartete Fehler als JSON melden, ohne Interna preiszugeben
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // Fehler des JSON-Parsers (kaputtes JSON, zu groß) sind Fehler der Anfrage, nicht des Servers
    const status = (err as { status?: number }).status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json({ fehler: status === 413 ? 'Die Anfrage ist zu groß.' : 'Ungültige Anfrage.' });
      return;
    }
    console.error(err);
    res.status(500).json({ fehler: 'Interner Serverfehler.' });
  });

  return app;
}
