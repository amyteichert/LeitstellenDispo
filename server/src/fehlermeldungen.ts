// „Fehler melden“: Spieler schicken eine Beschreibung, das Spiel hängt Kontext an, der Server den Spielstand-Überblick
import { Router, type Response } from 'express';
import { FEHLERMELDUNG_MAX_LAENGE, fasseSpielstandZusammen, type Fehlermeldung, type FehlermeldungKontext, type Konto } from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';
import { ladeKonto, nurAngemeldet } from './auth.js';
import type { KontenDienst } from './konten.js';

/** Höchstens so viele Meldungen pro Konto und Stunde */
const MAX_PRO_STUNDE = 5;

const kurz = (wert: unknown, max = 200) => (typeof wert === 'string' ? wert.slice(0, max) : '');

export function erstelleFehlermeldungRouter(db: Datenbank, konten: KontenDienst): Router {
  const router = Router();
  const sql = {
    anzahlLetzteStunde: db.prepare("SELECT COUNT(*) AS n FROM fehlermeldungen WHERE benutzer_id = ? AND zeit > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')"),
    spielstand: db.prepare('SELECT daten FROM spielstaende WHERE benutzer_id = ?'),
    anlegen: db.prepare('INSERT INTO fehlermeldungen (benutzer_id, name, text, kontext) VALUES (?, ?, ?, ?)'),
  };

  router.post('/', ladeKonto(konten), nurAngemeldet, (req, res: Response) => {
    const konto = res.locals.konto as Konto;
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (text.length < 5) return void res.status(400).json({ fehler: 'Bitte beschreib kurz, was passiert ist.' });
    if (text.length > FEHLERMELDUNG_MAX_LAENGE) return void res.status(400).json({ fehler: `Höchstens ${FEHLERMELDUNG_MAX_LAENGE} Zeichen.` });
    if ((sql.anzahlLetzteStunde.get(konto.id) as { n: number }).n >= MAX_PRO_STUNDE) {
      return void res.status(429).json({ fehler: 'Du hast gerade schon mehrere Meldungen geschickt – bitte später wieder.' });
    }
    const k = req.body?.kontext ?? {};
    const zeile = sql.spielstand.get(konto.id) as { daten: string } | undefined;
    const kontext = {
      version: kurz(k.version, 40),
      ansicht: kurz(k.ansicht, 40),
      geraet: kurz(k.geraet),
      bildschirm: kurz(k.bildschirm, 40),
      spielstand: zeile ? fasseSpielstandZusammen(JSON.parse(zeile.daten)) : null,
    } satisfies Fehlermeldung['kontext'] & FehlermeldungKontext;
    sql.anlegen.run(konto.id, konto.name, text, JSON.stringify(kontext));
    res.status(201).json({ ok: true });
  });

  return router;
}

/** Meldungen fürs Team: offene zuerst, dann die neuesten */
export function ladeFehlermeldungen(db: Datenbank): Fehlermeldung[] {
  const zeilen = db.prepare('SELECT id, name, text, kontext, zeit, erledigt FROM fehlermeldungen ORDER BY erledigt, id DESC LIMIT 100').all() as
    Array<Omit<Fehlermeldung, 'kontext' | 'erledigt'> & { kontext: string; erledigt: number }>;
  return zeilen.map((z) => ({ ...z, kontext: JSON.parse(z.kontext), erledigt: z.erledigt === 1 }));
}
