// „Fehler melden“: Spieler schicken eine Beschreibung, das Spiel hängt Kontext an, der Server den Spielstand-Überblick
import { Router, type Response } from 'express';
import { FEHLERMELDUNG_ANTWORT_MAX_LAENGE, FEHLERMELDUNG_MAX_LAENGE, fasseSpielstandZusammen, type Fehlermeldung, type FehlermeldungKontext, istMeldungGelesen, type Konto, type MeldungsAntwort } from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';
import { ladeKonto, nurAngemeldet, spielBasisUrl, type AuthOptionen } from './auth.js';
import type { KontenDienst } from './konten.js';
import { KEIN_MAILVERSAND } from './mail.js';
import type { Ereignisse } from './ereignisse.js';

/** Höchstens so viele Meldungen pro Konto und Stunde */
const MAX_PRO_STUNDE = 5;

const kurz = (wert: unknown, max = 200) => (typeof wert === 'string' ? wert.slice(0, max) : '');

export function erstelleFehlermeldungRouter(db: Datenbank, konten: KontenDienst, optionen: AuthOptionen = {}, ereignisse?: Ereignisse): Router {
  const router = Router();
  const mailversand = optionen.mailversand ?? KEIN_MAILVERSAND;
  const sql = {
    anzahlLetzteStunde: db.prepare("SELECT COUNT(*) AS n FROM fehlermeldungen WHERE benutzer_id = ? AND zeit > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')"),
    spielstand: db.prepare('SELECT daten FROM spielstaende WHERE benutzer_id = ?'),
    anlegen: db.prepare('INSERT INTO fehlermeldungen (benutzer_id, name, text, kontext) VALUES (?, ?, ?, ?)'),
    ownerMails: db.prepare("SELECT email FROM benutzer WHERE rolle = 'owner' AND email IS NOT NULL"),
    antworten: db.prepare(`SELECT id, CASE WHEN erledigt = 1 THEN 'erledigt' ELSE 'gelesen' END AS art, gelesen, antwort_von AS von, text, antwort FROM fehlermeldungen
      WHERE benutzer_id = ? AND (erledigt = 1 OR gelesen IS NOT NULL) AND gesehen = 0 ORDER BY id LIMIT 10`),
    gesehen: db.prepare('UPDATE fehlermeldungen SET gesehen = 1 WHERE benutzer_id = ? AND id = ?'),
  };

  // Gelesene/erledigte eigene Meldungen, die der Spieler noch nicht gesehen hat (Hinweis im Spiel)
  router.get('/antworten', ladeKonto(konten), nurAngemeldet, (_req, res: Response) => {
    const konto = res.locals.konto as Konto;
    const zeilen = sql.antworten.all(konto.id) as MeldungsAntwort[];
    res.json({ antworten: zeilen.map((z) => ({ ...z, text: z.text.length > 80 ? `${z.text.slice(0, 80)}…` : z.text })) });
  });

  // Spieler hat den Hinweis weggeklickt – nur eigene Meldungen
  router.post('/antworten/gesehen', ladeKonto(konten), nurAngemeldet, (req, res: Response) => {
    const konto = res.locals.konto as Konto;
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => Number.isInteger(id)).slice(0, 50) : [];
    db.transaction(() => ids.forEach((id: number) => sql.gesehen.run(konto.id, id)))();
    res.status(204).end();
  });

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
    const id = Number(sql.anlegen.run(konto.id, konto.name, text, JSON.stringify(kontext)).lastInsertRowid);
    res.status(201).json({ ok: true, id });
    // id: damit der Discord-Bot einen „Gelesen“-Knopf anbieten kann (POST /api/bot/fehlermeldung/:id/gelesen)
    ereignisse?.melde('fehlermeldung', { id, spieler: konto.name, text: text.slice(0, 1000), ansicht: kontext.ansicht, geraet: kontext.geraet });

    // Owner per Mail benachrichtigen – Fehler beim Versand dürfen die Meldung nicht kaputtmachen
    if (mailversand.aktiv) {
      const link = spielBasisUrl(req, optionen.spielUrl);
      for (const { email } of sql.ownerMails.all() as Array<{ email: string }>) {
        mailversand
          .sende({
            an: email,
            betreff: `Neue Meldung von ${konto.name}`,
            text: [
              `${konto.name} hat einen Fehler gemeldet:`,
              '',
              text,
              '',
              `Ansicht: ${kontext.ansicht || '–'} · Gerät: ${kontext.geraet || '–'}`,
              '',
              `Alle Meldungen im Spiel unter Team → Meldungen: ${link}`,
            ].join('\n'),
          })
          .catch((fehler) => console.error('Mail zur Fehlermeldung ging nicht raus:', fehler));
      }
    }
  });

  return router;
}

/** Meldungen fürs Team: offene zuerst, dann die neuesten */
export function ladeFehlermeldungen(db: Datenbank): Fehlermeldung[] {
  const zeilen = db.prepare('SELECT id, name, text, kontext, zeit, erledigt, antwort, gelesen, antwort_von AS von FROM fehlermeldungen ORDER BY erledigt, id DESC LIMIT 100').all() as
    Array<Omit<Fehlermeldung, 'kontext' | 'erledigt'> & { kontext: string; erledigt: number }>;
  return zeilen.map((z) => ({ ...z, kontext: JSON.parse(z.kontext), erledigt: z.erledigt === 1 }));
}

/**
 * Meldung erledigen (mit optionaler Antwort) oder wieder öffnen. Beim Erledigen bekommt der Spieler einen Hinweis im Spiel.
 * Gibt eine Fehlermeldung zurück oder null.
 */
export function setzeFehlermeldungErledigt(db: Datenbank, id: number, erledigt: boolean, antwort: unknown, von: string | null = null): string | null {
  const text = typeof antwort === 'string' ? antwort.trim() : '';
  if (text.length > FEHLERMELDUNG_ANTWORT_MAX_LAENGE) return `Die Antwort darf höchstens ${FEHLERMELDUNG_ANTWORT_MAX_LAENGE} Zeichen haben.`;
  if (erledigt) db.prepare('UPDATE fehlermeldungen SET erledigt = 1, antwort = ?, antwort_von = ?, gesehen = 0 WHERE id = ?').run(text || null, von, id);
  else db.prepare('UPDATE fehlermeldungen SET erledigt = 0, gesehen = 1 WHERE id = ?').run(id);
  return null;
}

/**
 * Team hat die Meldung gelesen (im Spiel oder über Discord): Der Spieler bekommt beim nächsten Spielen einen Hinweis.
 * Gibt eine Fehlermeldung zurück oder null. Bereits erledigte Meldungen bleiben unverändert.
 */
export function setzeFehlermeldungGelesen(db: Datenbank, id: number, art: unknown, von: string | null = null): string | null {
  if (!istMeldungGelesen(art)) return 'Unbekannte Art – erlaubt sind „umsetzen“ und „anschauen“.';
  const zeile = db.prepare('SELECT erledigt FROM fehlermeldungen WHERE id = ?').get(id) as { erledigt: number } | undefined;
  if (!zeile) return 'Meldung nicht gefunden.';
  if (zeile.erledigt === 1) return 'Die Meldung ist schon erledigt.';
  db.prepare('UPDATE fehlermeldungen SET gelesen = ?, antwort_von = ?, gesehen = 0 WHERE id = ?').run(art, von, id);
  return null;
}
