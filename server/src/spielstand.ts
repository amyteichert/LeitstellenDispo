// Spielstand pro Konto: laden, speichern, löschen
import express, { Router, type Request, type Response } from 'express';
import { deutscherTag, einnahmenAuffaellig, entferneAlteEinsaetze, migriereSpielstand, pruefeGuthaben, naechsteSerie, schichtzulageBetrag, type Konto, type SchichtzulageAntwort, type Spielstand } from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';
import { ladeKonto, nurAngemeldet } from './auth.js';
import type { KontenDienst } from './konten.js';
import { ladeOffeneKorrekturen } from './team.js';

/** Ein Spielstand mit langer Einsatzhistorie und Funkverkehr kann deutlich über das Express-Standardlimit (100 kB) wachsen */
export const SPIELSTAND_MAX_GROESSE = '5mb';

export function erstelleSpielstandRouter(db: Datenbank, konten: KontenDienst, einsaetzeAufraeumenBis?: number): Router {
  const router = Router();
  const sql = {
    laden: db.prepare('SELECT daten FROM spielstaende WHERE benutzer_id = ?'),
    ladenMitZeit: db.prepare('SELECT daten, aktualisiert FROM spielstaende WHERE benutzer_id = ?'),
    protokollieren: db.prepare("INSERT INTO team_protokoll (von_name, aktion, ziel_name, details) VALUES ('System', ?, ?, ?)"),
    speichern: db.prepare(`
      INSERT INTO spielstaende (benutzer_id, daten, aktualisiert)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ON CONFLICT (benutzer_id) DO UPDATE SET daten = excluded.daten, aktualisiert = excluded.aktualisiert`),
    loeschen: db.prepare('DELETE FROM spielstaende WHERE benutzer_id = ?'),
    zulageLaden: db.prepare('SELECT letzter_tag AS letzterTag, serie FROM schichtzulage WHERE benutzer_id = ?'),
    zulageMerken: db.prepare(`
      INSERT INTO schichtzulage (benutzer_id, letzter_tag, serie) VALUES (?, ?, ?)
      ON CONFLICT (benutzer_id) DO UPDATE SET letzter_tag = excluded.letzter_tag, serie = excluded.serie`),
    zulageBuchen: db.prepare(`INSERT INTO spielstand_korrekturen (benutzer_id, guthaben_aenderung, grund, von_name, art) VALUES (?, ?, ?, 'System', 'schichtzulage')`),
  };

  const kontoId = (res: Response) => (res.locals.konto as Konto).id;

  /**
   * Schutz gegen Schummeln: Guthaben, das keine Buchung erklärt, wird auf den erklärbaren Wert gekürzt.
   * Unrealistisch hohe Einnahmen werden nur im Team-Protokoll vermerkt (ehrliche Spieler verlieren nie Geld).
   */
  function pruefePlausibilitaet(konto: Konto, neu: Spielstand) {
    const zeile = sql.ladenMitZeit.get(konto.id) as { daten: string; aktualisiert: string } | undefined;
    const alt = zeile ? migriereSpielstand(JSON.parse(zeile.daten)) : null;
    if (!alt) return; // erster Spielstand (oder Übernahme aus dem Browser)
    // „Neues Spiel starten“: neue Startbuchung (anderer Zeitpunkt) – der alte Stand zählt nicht mehr
    const startZeit = (stand: Pick<Spielstand, 'transactions'>) => stand.transactions.find((tx) => tx.id === 'initial-balance')?.createdAt;
    if (startZeit(neu) !== startZeit(alt)) return;
    const pruefung = pruefeGuthaben(alt, neu);
    if (pruefung.erlaubtesGuthaben !== neu.balance) {
      sql.protokollieren.run('Guthaben korrigiert', konto.name,
        `${Math.round(neu.balance).toLocaleString('de-DE')} € ohne passende Buchungen – auf ${Math.round(pruefung.erlaubtesGuthaben).toLocaleString('de-DE')} € gesetzt`);
      neu.balance = pruefung.erlaubtesGuthaben;
    }
    if (einnahmenAuffaellig(pruefung.neueEinnahmen, Date.now() - Date.parse(zeile!.aktualisiert))) {
      sql.protokollieren.run('Auffällige Einnahmen', konto.name, `${Math.round(pruefung.neueEinnahmen).toLocaleString('de-DE')} € seit dem letzten Speichern`);
    }
  }

  router.use(express.json({ limit: SPIELSTAND_MAX_GROESSE }), ladeKonto(konten), nurAngemeldet);

  /** Team-Aufräumen: alte Einsätze raus (null = nichts zu tun) */
  const aufgeraeumt = (stand: Spielstand) => (einsaetzeAufraeumenBis ? entferneAlteEinsaetze(stand, einsaetzeAufraeumenBis) : null);

  router.get('/', (_req, res) => {
    const zeile = sql.laden.get(kontoId(res)) as { daten: string } | undefined;
    const stand = zeile ? JSON.parse(zeile.daten) as Spielstand : null;
    const neu = stand && aufgeraeumt(stand);
    if (neu) sql.speichern.run(kontoId(res), JSON.stringify(neu));
    res.json({ spielstand: neu ?? stand });
  });

  router.put('/', (req: Request, res) => {
    // Grobe Formprüfung über dieselbe Funktion, mit der der Client lädt – kaputte Stände gar nicht erst speichern
    if (!migriereSpielstand(req.body)) {
      return void res.status(400).json({ fehler: 'Ungültiger Spielstand.' });
    }
    const neu = req.body as Spielstand;
    pruefePlausibilitaet(res.locals.konto as Konto, neu);
    // Offenes Spiel mit alten Einsätzen: aufgeräumt speichern und das Spiel neu laden lassen
    const ohneAlte = aufgeraeumt(neu);
    sql.speichern.run(kontoId(res), JSON.stringify(ohneAlte ?? neu));
    if (ohneAlte) return void res.json({ neuLaden: true });
    res.status(204).end();
  });

  // Vom Team angelegte Korrekturen: Das Spiel holt sie ab, bucht sie ein und bestätigt sie danach
  router.get('/korrekturen', (_req, res) => {
    res.json({ korrekturen: ladeOffeneKorrekturen(db, kontoId(res)) });
  });

  router.post('/korrekturen/eingebucht', (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => Number.isInteger(id)).slice(0, 100) : [];
    const markieren = db.prepare('UPDATE spielstand_korrekturen SET eingebucht = 1 WHERE id = ? AND benutzer_id = ?');
    db.transaction(() => ids.forEach((id: number) => markieren.run(id, kontoId(res))))();
    res.status(204).end();
  });

  // Schichtzulage: höchstens einmal pro Tag (deutsche Zeit). Sie wird als Korrektur angelegt –
  // das Spiel bucht sie über denselben Weg ein, so überschreibt ein laufendes Spiel sie nicht.
  router.post('/schichtzulage', (_req, res) => {
    const id = kontoId(res);
    const antwort = db.transaction((): SchichtzulageAntwort => {
      const heute = deutscherTag(Date.now());
      const bisher = sql.zulageLaden.get(id) as { letzterTag: string; serie: number } | undefined;
      const serie = naechsteSerie(bisher?.letzterTag ?? null, bisher?.serie ?? 0, heute);
      if (serie === null) return { erhalten: false, serie: bisher!.serie };
      const betrag = schichtzulageBetrag(serie);
      sql.zulageMerken.run(id, heute, serie);
      sql.zulageBuchen.run(id, betrag, `Schichtzulage – Tag ${serie} in Folge`);
      return { erhalten: true, betrag, serie, morgen: schichtzulageBetrag(serie + 1) };
    })();
    res.json(antwort);
  });

  router.delete('/', (_req, res) => {
    sql.loeschen.run(kontoId(res));
    res.status(204).end();
  });

  return router;
}
