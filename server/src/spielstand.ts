// Spielstand pro Konto: laden, speichern, löschen
import express, { Router, type Request, type Response } from 'express';
import { migriereSpielstand, type Konto } from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';
import { ladeKonto, nurAngemeldet } from './auth.js';
import type { KontenDienst } from './konten.js';

/** Ein Spielstand mit langer Einsatzhistorie und Funkverkehr kann deutlich über das Express-Standardlimit (100 kB) wachsen */
export const SPIELSTAND_MAX_GROESSE = '5mb';

export function erstelleSpielstandRouter(db: Datenbank, konten: KontenDienst): Router {
  const router = Router();
  const sql = {
    laden: db.prepare('SELECT daten FROM spielstaende WHERE benutzer_id = ?'),
    speichern: db.prepare(`
      INSERT INTO spielstaende (benutzer_id, daten, aktualisiert)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ON CONFLICT (benutzer_id) DO UPDATE SET daten = excluded.daten, aktualisiert = excluded.aktualisiert`),
    loeschen: db.prepare('DELETE FROM spielstaende WHERE benutzer_id = ?'),
  };

  const kontoId = (res: Response) => (res.locals.konto as Konto).id;

  router.use(express.json({ limit: SPIELSTAND_MAX_GROESSE }), ladeKonto(konten), nurAngemeldet);

  router.get('/', (_req, res) => {
    const zeile = sql.laden.get(kontoId(res)) as { daten: string } | undefined;
    res.json({ spielstand: zeile ? JSON.parse(zeile.daten) : null });
  });

  router.put('/', (req: Request, res) => {
    // Grobe Formprüfung über dieselbe Funktion, mit der der Client lädt – kaputte Stände gar nicht erst speichern
    if (!migriereSpielstand(req.body)) {
      return void res.status(400).json({ fehler: 'Ungültiger Spielstand.' });
    }
    sql.speichern.run(kontoId(res), JSON.stringify(req.body));
    res.status(204).end();
  });

  router.delete('/', (_req, res) => {
    sql.loeschen.run(kontoId(res));
    res.status(204).end();
  });

  return router;
}
