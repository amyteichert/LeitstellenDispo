// Team-Bereich: Übersicht, Kontenverwaltung, Spielstände einsehen und Dev-Markierung – nur für Owner, Co-Owner, Admin
import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  darfKontoVerwalten,
  darfRolleVergeben,
  fasseSpielstandZusammen,
  istTeamRolle,
  type Konto,
  type TeamKonto,
  type TeamUebersicht,
  type UserRole,
} from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';
import { ladeKonto, nurAngemeldet } from './auth.js';
import type { KontenDienst } from './konten.js';

interface TeamKontoZeile {
  id: number;
  name: string;
  rolle: UserRole;
  gesperrt: number;
  erstellt: string;
  dev_markiert: number;
  zuletzt: string | null;
}

const zuTeamKonto = (z: TeamKontoZeile): TeamKonto => ({
  id: z.id,
  name: z.name,
  rolle: z.rolle,
  erstellt: z.erstellt,
  gesperrt: Boolean(z.gesperrt),
  devMarkiert: Boolean(z.dev_markiert),
  zuletztGespielt: z.zuletzt,
});

/** Lässt nur Team-Rollen durch (nach `ladeKonto`/`nurAngemeldet` verwenden). */
export function nurTeam(_req: Request, res: Response, next: NextFunction) {
  if (!istTeamRolle((res.locals.konto as Konto).rolle)) {
    res.status(403).json({ fehler: 'Nur für das Team.' });
    return;
  }
  next();
}

const KONTO_SPALTEN = `
  b.id, b.name, b.rolle, b.gesperrt, b.erstellt, b.dev_markiert, s.aktualisiert AS zuletzt
  FROM benutzer b LEFT JOIN spielstaende s ON s.benutzer_id = b.id`;

export function erstelleTeamRouter(db: Datenbank, konten: KontenDienst): Router {
  const router = Router();
  const sql = {
    konto: db.prepare(`SELECT ${KONTO_SPALTEN} WHERE b.id = ?`),
    suche: db.prepare(`SELECT ${KONTO_SPALTEN} WHERE b.name LIKE ? ESCAPE '\\' ORDER BY b.id LIMIT 200`),
    uebersicht: db.prepare(`
      SELECT
        COUNT(*) AS konten,
        SUM(b.rolle != 'player') AS team,
        SUM(b.gesperrt) AS gesperrt,
        SUM(b.erstellt >= ?) AS neuLetzte7Tage,
        SUM(s.aktualisiert >= ?) AS aktivHeute,
        SUM(s.aktualisiert >= ?) AS aktivLetzte7Tage,
        SUM(s.benutzer_id IS NOT NULL) AS mitSpielstand
      FROM benutzer b LEFT JOIN spielstaende s ON s.benutzer_id = b.id`),
    spielstand: db.prepare('SELECT daten FROM spielstaende WHERE benutzer_id = ?'),
    sperren: db.prepare('UPDATE benutzer SET gesperrt = ? WHERE id = ?'),
    rolle: db.prepare('UPDATE benutzer SET rolle = ? WHERE id = ?'),
    loeschen: db.prepare('DELETE FROM benutzer WHERE id = ?'),
    spielstandLoeschen: db.prepare('DELETE FROM spielstaende WHERE benutzer_id = ?'),
    sitzungenBeenden: db.prepare('DELETE FROM sitzungen WHERE benutzer_id = ?'),
    devMarkieren: db.prepare('UPDATE benutzer SET dev_markiert = 1 WHERE id = ?'),
  };

  const ich = (res: Response) => res.locals.konto as Konto;

  /** Lädt das Zielkonto und prüft den Rang – antwortet selbst mit 404/403, wenn es nicht passt. */
  function zielKonto(req: Request, res: Response): TeamKonto | null {
    const zeile = sql.konto.get(Number(req.params.id)) as TeamKontoZeile | undefined;
    if (!zeile) {
      res.status(404).json({ fehler: 'Konto nicht gefunden.' });
      return null;
    }
    const ziel = zuTeamKonto(zeile);
    if (!darfKontoVerwalten(ich(res), ziel)) {
      res.status(403).json({ fehler: 'Dieses Konto darfst du nicht verwalten.' });
      return null;
    }
    return ziel;
  }

  router.use(ladeKonto(konten), nurAngemeldet);

  // Dev-Markierung fürs eigene Konto: wird gesetzt, bevor ein Dev-Werkzeug benutzt wird
  router.post('/dev-markierung', nurTeam, (_req, res) => {
    sql.devMarkieren.run(ich(res).id);
    res.status(204).end();
  });

  router.use(nurTeam);

  router.get('/uebersicht', (_req, res) => {
    const jetzt = Date.now();
    const heute = new Date(jetzt - 24 * 60 * 60 * 1000).toISOString();
    const woche = new Date(jetzt - 7 * 24 * 60 * 60 * 1000).toISOString();
    const z = sql.uebersicht.get(woche, heute, woche) as Record<keyof TeamUebersicht, number | null>;
    const uebersicht = Object.fromEntries(Object.entries(z).map(([k, v]) => [k, v ?? 0])) as unknown as TeamUebersicht;
    res.json({ uebersicht });
  });

  router.get('/konten', (req, res) => {
    const suche = typeof req.query.suche === 'string' ? req.query.suche.trim().slice(0, 50) : '';
    const muster = `%${suche.replace(/[\\%_]/g, (zeichen) => `\\${zeichen}`)}%`;
    res.json({ konten: (sql.suche.all(muster) as TeamKontoZeile[]).map(zuTeamKonto) });
  });

  router.get('/konten/:id/spielstand', (req, res) => {
    const zeile = sql.konto.get(Number(req.params.id)) as TeamKontoZeile | undefined;
    if (!zeile) return void res.status(404).json({ fehler: 'Konto nicht gefunden.' });
    const stand = sql.spielstand.get(zeile.id) as { daten: string } | undefined;
    res.json({ zusammenfassung: stand ? fasseSpielstandZusammen(JSON.parse(stand.daten)) : null });
  });

  router.post('/konten/:id/sperren', (req, res) => {
    const ziel = zielKonto(req, res);
    if (!ziel) return;
    const gesperrt = req.body?.gesperrt === true;
    db.transaction(() => {
      sql.sperren.run(gesperrt ? 1 : 0, ziel.id);
      if (gesperrt) sql.sitzungenBeenden.run(ziel.id); // sofort abmelden
    })();
    res.json({ konto: zuTeamKonto(sql.konto.get(ziel.id) as TeamKontoZeile) });
  });

  router.post('/konten/:id/rolle', (req, res) => {
    const rolle = req.body?.rolle as UserRole;
    const zeile = sql.konto.get(Number(req.params.id)) as TeamKontoZeile | undefined;
    if (!zeile) return void res.status(404).json({ fehler: 'Konto nicht gefunden.' });
    if (!darfRolleVergeben(ich(res), zeile, rolle)) {
      return void res.status(403).json({ fehler: 'Rollen vergibt nur der Owner – nicht an sich selbst und nicht die Owner-Rolle.' });
    }
    sql.rolle.run(rolle, zeile.id);
    res.json({ konto: zuTeamKonto(sql.konto.get(zeile.id) as TeamKontoZeile) });
  });

  router.delete('/konten/:id/spielstand', (req, res) => {
    const ziel = zielKonto(req, res);
    if (!ziel) return;
    sql.spielstandLoeschen.run(ziel.id);
    res.status(204).end();
  });

  router.delete('/konten/:id', (req, res) => {
    const ziel = zielKonto(req, res);
    if (!ziel) return;
    sql.loeschen.run(ziel.id); // Sitzungen und Spielstand fallen per ON DELETE CASCADE mit weg
    res.status(204).end();
  });

  return router;
}
