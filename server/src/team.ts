// Team-Bereich: Übersicht, Kontenverwaltung, Spielstände einsehen und Dev-Markierung – nur für Owner, Co-Owner, Admin
import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  ANKUENDIGUNG_MAX_LAENGE,
  NOTIZ_MAX_LAENGE,
  RUF_CONFIG,
  darfKontoVerwalten,
  darfRolleVergeben,
  fasseSpielstandZusammen,
  istTeamRolle,
  type Ankuendigung,
  type AnkuendigungsArt,
  type Konto,
  type KontoNotiz,
  type SpielstandKorrektur,
  type TeamKonto,
  type TeamProtokollEintrag,
  type TeamUebersicht,
  type UserRole,
} from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';
import { ladeKonto, nurAngemeldet, passwortLink, spielBasisUrl, type AuthOptionen } from './auth.js';
import type { KontenDienst } from './konten.js';

interface TeamKontoZeile {
  id: number;
  name: string;
  rolle: UserRole;
  gesperrt: number;
  erstellt: string;
  dev_markiert: number;
  email: string | null;
  zuletzt: string | null;
}

const zuTeamKonto = (z: TeamKontoZeile): TeamKonto => ({
  id: z.id,
  name: z.name,
  rolle: z.rolle,
  erstellt: z.erstellt,
  email: z.email,
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
  b.id, b.name, b.rolle, b.gesperrt, b.erstellt, b.dev_markiert, b.email, s.aktualisiert AS zuletzt
  FROM benutzer b LEFT JOIN spielstaende s ON s.benutzer_id = b.id`;

export function erstelleTeamRouter(db: Datenbank, konten: KontenDienst, optionen: AuthOptionen = {}): Router {
  const router = Router();
  const sql = {
    konto: db.prepare(`SELECT ${KONTO_SPALTEN} WHERE b.id = ?`),
    suche: db.prepare(`SELECT ${KONTO_SPALTEN} WHERE b.name LIKE ? ESCAPE '\\' OR b.email LIKE ? ESCAPE '\\' ORDER BY b.id LIMIT 200`),
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
    protokollieren: db.prepare('INSERT INTO team_protokoll (von_name, aktion, ziel_name, details) VALUES (?, ?, ?, ?)'),
    protokoll: db.prepare(`
      SELECT id, zeit, von_name AS vonName, aktion, ziel_name AS zielName, details
      FROM team_protokoll ORDER BY id DESC LIMIT 200`),
    notizen: db.prepare('SELECT id, zeit, von_name AS vonName, text FROM konto_notizen WHERE benutzer_id = ? ORDER BY id DESC'),
    notizAnlegen: db.prepare('INSERT INTO konto_notizen (benutzer_id, von_name, text) VALUES (?, ?, ?)'),
    notiz: db.prepare('SELECT id, benutzer_id FROM konto_notizen WHERE id = ?'),
    notizLoeschen: db.prepare('DELETE FROM konto_notizen WHERE id = ?'),
    ankuendigungSetzen: db.prepare(`
      INSERT INTO ankuendigung (id, text, art, von_name, zeit) VALUES (1, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ON CONFLICT (id) DO UPDATE SET text = excluded.text, art = excluded.art, von_name = excluded.von_name, zeit = excluded.zeit`),
    ankuendigungLoeschen: db.prepare('DELETE FROM ankuendigung'),
    korrekturAnlegen: db.prepare('INSERT INTO spielstand_korrekturen (benutzer_id, guthaben_aenderung, ruf_neu, grund, von_name) VALUES (?, ?, ?, ?, ?)'),
    korrekturen: db.prepare(`
      SELECT id, guthaben_aenderung AS guthabenAenderung, ruf_neu AS rufNeu, grund, zeit, eingebucht
      FROM spielstand_korrekturen WHERE benutzer_id = ? ORDER BY id DESC LIMIT 50`),
  };

  /** Hält jede Team-Aktion im Protokoll fest */
  const protokolliere = (von: Konto, aktion: string, ziel?: Pick<TeamKonto, 'name'> | null, details?: string) =>
    sql.protokollieren.run(von.name, aktion, ziel?.name ?? null, details ?? null);

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
    res.json({ konten: (sql.suche.all(muster, muster) as TeamKontoZeile[]).map(zuTeamKonto) });
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
      protokolliere(ich(res), gesperrt ? 'Konto gesperrt' : 'Konto entsperrt', ziel);
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
    protokolliere(ich(res), 'Rolle geändert', zeile, `${zeile.rolle} → ${rolle}`);
    res.json({ konto: zuTeamKonto(sql.konto.get(zeile.id) as TeamKontoZeile) });
  });

  // Link zum Zurücksetzen des Passworts erzeugen und selbst weitergeben (solange es keinen Mailversand gibt)
  router.post('/konten/:id/passwort-link', (req, res) => {
    const ziel = zielKonto(req, res);
    if (!ziel) return;
    const { token, laeuftAb } = konten.erstellePasswortToken(ziel.id);
    protokolliere(ich(res), 'Passwort-Link erzeugt', ziel);
    res.json({ link: passwortLink(spielBasisUrl(req, optionen.spielUrl), token), laeuftAb });
  });

  router.delete('/konten/:id/spielstand', (req, res) => {
    const ziel = zielKonto(req, res);
    if (!ziel) return;
    sql.spielstandLoeschen.run(ziel.id);
    protokolliere(ich(res), 'Spielstand zurückgesetzt', ziel);
    res.status(204).end();
  });

  router.delete('/konten/:id', (req, res) => {
    const ziel = zielKonto(req, res);
    if (!ziel) return;
    sql.loeschen.run(ziel.id); // Sitzungen und Spielstand fallen per ON DELETE CASCADE mit weg
    protokolliere(ich(res), 'Konto gelöscht', ziel);
    res.status(204).end();
  });

  // ---- Aktivitäts-Protokoll ----
  router.get('/protokoll', (_req, res) => {
    res.json({ eintraege: sql.protokoll.all() as TeamProtokollEintrag[] });
  });

  // ---- Notizen zu Konten (nur fürs Team sichtbar) ----
  router.get('/konten/:id/notizen', (req, res) => {
    const zeile = sql.konto.get(Number(req.params.id)) as TeamKontoZeile | undefined;
    if (!zeile) return void res.status(404).json({ fehler: 'Konto nicht gefunden.' });
    res.json({ notizen: sql.notizen.all(zeile.id) as KontoNotiz[] });
  });

  router.post('/konten/:id/notizen', (req, res) => {
    const zeile = sql.konto.get(Number(req.params.id)) as TeamKontoZeile | undefined;
    if (!zeile) return void res.status(404).json({ fehler: 'Konto nicht gefunden.' });
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return void res.status(400).json({ fehler: 'Die Notiz ist leer.' });
    if (text.length > NOTIZ_MAX_LAENGE) return void res.status(400).json({ fehler: `Höchstens ${NOTIZ_MAX_LAENGE} Zeichen.` });
    sql.notizAnlegen.run(zeile.id, ich(res).name, text);
    protokolliere(ich(res), 'Notiz angelegt', zeile);
    res.status(201).json({ notizen: sql.notizen.all(zeile.id) as KontoNotiz[] });
  });

  router.delete('/notizen/:id', (req, res) => {
    const notiz = sql.notiz.get(Number(req.params.id)) as { id: number; benutzer_id: number } | undefined;
    if (!notiz) return void res.status(404).json({ fehler: 'Notiz nicht gefunden.' });
    sql.notizLoeschen.run(notiz.id);
    protokolliere(ich(res), 'Notiz gelöscht', sql.konto.get(notiz.benutzer_id) as TeamKontoZeile | undefined);
    res.status(204).end();
  });

  // ---- Ankündigung an alle Spieler ----
  router.put('/ankuendigung', (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const art: AnkuendigungsArt = ['info', 'wartung', 'wichtig'].includes(req.body?.art) ? req.body.art : 'info';
    if (!text) return void res.status(400).json({ fehler: 'Die Ankündigung ist leer.' });
    if (text.length > ANKUENDIGUNG_MAX_LAENGE) return void res.status(400).json({ fehler: `Höchstens ${ANKUENDIGUNG_MAX_LAENGE} Zeichen.` });
    sql.ankuendigungSetzen.run(text, art, ich(res).name);
    protokolliere(ich(res), 'Ankündigung veröffentlicht', null, text);
    res.json({ ankuendigung: ladeAnkuendigung(db) });
  });

  router.delete('/ankuendigung', (_req, res) => {
    sql.ankuendigungLoeschen.run();
    protokolliere(ich(res), 'Ankündigung entfernt');
    res.status(204).end();
  });

  // ---- Spielstand korrigieren: Das Spiel des Spielers bucht die Korrektur selbst ein ----
  router.get('/konten/:id/korrekturen', (req, res) => {
    const ziel = zielKonto(req, res);
    if (!ziel) return;
    res.json({ korrekturen: sql.korrekturen.all(ziel.id) });
  });

  router.post('/konten/:id/korrekturen', (req, res) => {
    const ziel = zielKonto(req, res);
    if (!ziel) return;
    const guthabenAenderung = Math.round(Number(req.body?.guthabenAenderung ?? 0));
    const rufRoh = req.body?.rufNeu;
    const rufNeu = rufRoh === null || rufRoh === undefined || rufRoh === '' ? null : Math.round(Number(rufRoh));
    const grund = typeof req.body?.grund === 'string' ? req.body.grund.trim().slice(0, 200) : '';
    if (!Number.isFinite(guthabenAenderung) || Math.abs(guthabenAenderung) > 100_000_000) {
      return void res.status(400).json({ fehler: 'Ungültiger Betrag.' });
    }
    if (rufNeu !== null && (!Number.isFinite(rufNeu) || rufNeu < RUF_CONFIG.min || rufNeu > RUF_CONFIG.max)) {
      return void res.status(400).json({ fehler: `Der Ruf muss zwischen ${RUF_CONFIG.min} und ${RUF_CONFIG.max} liegen.` });
    }
    if (guthabenAenderung === 0 && rufNeu === null) return void res.status(400).json({ fehler: 'Es gibt nichts zu korrigieren.' });
    if (!grund) return void res.status(400).json({ fehler: 'Bitte einen Grund angeben.' });
    sql.korrekturAnlegen.run(ziel.id, guthabenAenderung, rufNeu, grund, ich(res).name);
    const teile = [guthabenAenderung !== 0 && `Guthaben ${guthabenAenderung > 0 ? '+' : ''}${guthabenAenderung} €`, rufNeu !== null && `Ruf → ${rufNeu}`].filter(Boolean);
    protokolliere(ich(res), 'Spielstand korrigiert', ziel, `${teile.join(', ')} – ${grund}`);
    res.status(201).json({ korrekturen: sql.korrekturen.all(ziel.id) });
  });

  return router;
}

/** Aktuelle Ankündigung des Teams – `null`, wenn keine aktiv ist. */
export function ladeAnkuendigung(db: Datenbank): Ankuendigung | null {
  const zeile = db.prepare('SELECT text, art, von_name AS vonName, zeit FROM ankuendigung WHERE id = 1').get() as Ankuendigung | undefined;
  return zeile ?? null;
}

/** Offene (noch nicht eingebuchte) Korrekturen eines Spielers */
export function ladeOffeneKorrekturen(db: Datenbank, benutzerId: number): SpielstandKorrektur[] {
  return db.prepare(`
    SELECT id, guthaben_aenderung AS guthabenAenderung, ruf_neu AS rufNeu, grund, zeit
    FROM spielstand_korrekturen WHERE benutzer_id = ? AND eingebucht = 0 ORDER BY id`).all(benutzerId) as SpielstandKorrektur[];
}
