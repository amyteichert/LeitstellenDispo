// Spielstand pro Konto: laden, speichern, löschen
import express, { Router, type Request, type Response } from 'express';
import {
  LAUFBAHN_START, LEERER_FINANZSTAND, RUF_CONFIG, istGueltigeLaufbahn, pruefeBestand, zaehleWachen, begrenzeStartbuchung, darfDevWerkzeuge, deutscherTag, einnahmenAuffaellig, entferneAlteEinsaetze,
  erlaubteKreditAuszahlung, istServerGutschrift, migriereSpielstand, pruefeGuthaben, pruefeLaufbahn, naechsteSerie, schichtzulageBetrag,
  type Konto, type SchichtzulageAntwort, type Spielstand,
} from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';
import { ladeKonto, nurAngemeldet } from './auth.js';
import { erstelleFehlversuchBremse } from './fehlversuchBremse.js';
import type { KontenDienst } from './konten.js';
import { ladeOffeneKorrekturen } from './team.js';

/** Ein Spielstand mit langer Einsatzhistorie und Funkverkehr kann deutlich über das Express-Standardlimit (100 kB) wachsen */
export const SPIELSTAND_MAX_GROESSE = '5mb';

/** Drosselung je Konto: so viele Speichervorgänge sind in diesem Zeitfenster erlaubt */
export const SPEICHERN_MAX_PRO_FENSTER = 15;
export const SPEICHERN_FENSTER_MS = 10_000;

/** `nachSpeichern`: wird nach jedem gespeicherten Stand aufgerufen (z. B. Großeinsätze für den Discord-Bot erkennen) */
/** Anfrage mit Konflikterkennung: { spielstand, version } statt nur dem Spielstand */
const istSpeicherAnfrage = (body: unknown): body is { spielstand: unknown; version: number } =>
  Boolean(body) && typeof body === 'object' && 'spielstand' in (body as object)
  && typeof (body as { version?: unknown }).version === 'number';

export function erstelleSpielstandRouter(db: Datenbank, konten: KontenDienst, einsaetzeAufraeumenBis?: number, nachSpeichern?: (konto: Konto, stand: Spielstand) => void): Router {
  const router = Router();
  // Je Konto: höchstens SPEICHERN_MAX_PRO_FENSTER Speichervorgänge im Zeitfenster (das Spiel braucht ca. 1 pro 3 s)
  const speicherBremse = erstelleFehlversuchBremse({ maxVersuche: SPEICHERN_MAX_PRO_FENSTER, fensterMs: SPEICHERN_FENSTER_MS });
  const sql = {
    laden: db.prepare('SELECT daten, stand_version AS standVersion FROM spielstaende WHERE benutzer_id = ?'),
    ladenMitZeit: db.prepare('SELECT daten, aktualisiert, stand_version AS standVersion FROM spielstaende WHERE benutzer_id = ?'),
    version: db.prepare('SELECT stand_version AS standVersion FROM spielstaende WHERE benutzer_id = ?'),
    protokollieren: db.prepare("INSERT INTO team_protokoll (von_name, aktion, ziel_name, details) VALUES ('System', ?, ?, ?)"),
    speichern: db.prepare(`
      INSERT INTO spielstaende (benutzer_id, daten, aktualisiert, stand_version)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 1)
      ON CONFLICT (benutzer_id) DO UPDATE SET daten = excluded.daten, aktualisiert = excluded.aktualisiert,
        stand_version = spielstaende.stand_version + 1`),
    loeschen: db.prepare('DELETE FROM spielstaende WHERE benutzer_id = ?'),
    zulageLaden: db.prepare('SELECT letzter_tag AS letzterTag, serie FROM schichtzulage WHERE benutzer_id = ?'),
    zulageMerken: db.prepare(`
      INSERT INTO schichtzulage (benutzer_id, letzter_tag, serie) VALUES (?, ?, ?)
      ON CONFLICT (benutzer_id) DO UPDATE SET letzter_tag = excluded.letzter_tag, serie = excluded.serie`),
    zulageBuchen: db.prepare(`INSERT INTO spielstand_korrekturen (benutzer_id, guthaben_aenderung, grund, von_name, art) VALUES (?, ?, ?, 'System', 'schichtzulage')`),
    /** Alles, was der Server diesem Konto je gutgeschrieben hat (Schichtzulagen, Team-Korrekturen) */
    serverGutschriften: db.prepare('SELECT coalesce(sum(guthaben_aenderung), 0) AS summe FROM spielstand_korrekturen WHERE benutzer_id = ? AND guthaben_aenderung > 0'),
  };

  const kontoId = (res: Response) => (res.locals.konto as Konto).id;

  /**
   * Schutz gegen Schummeln: Guthaben, das keine Buchung erklärt, wird auf den erklärbaren Wert gekürzt.
   * Buchungen, die der Server selbst kennt (Schichtzulage, Team-Korrektur, Dev-Werkzeug, Kredit), müssen zu seinen Daten passen.
   * Unrealistisch hohe Einnahmen aus dem Spiel werden nur im Team-Protokoll vermerkt (ehrliche Spieler verlieren nie Geld).
   * EP und Einsätze (Bestenliste) dürfen nur so schnell wachsen, wie es das Einsatzaufkommen zulässt.
   */
  function pruefePlausibilitaet(konto: Konto, neu: Spielstand) {
    const zeile = sql.ladenMitZeit.get(konto.id) as { daten: string; aktualisiert: string } | undefined;
    const alt = zeile ? migriereSpielstand(JSON.parse(zeile.daten)) : null;
    // Erster Spielstand eines Kontos: Vergleich mit „nichts“ seit der Registrierung
    const vergangeneMs = Date.now() - Date.parse(zeile?.aktualisiert ?? konto.erstellt);
    // „Neues Spiel starten“: neue Startbuchung (anderer Zeitpunkt) – dann zählt der alte Stand nicht, sondern ein leerer Start
    const startZeit = (stand: Pick<Spielstand, 'transactions'>) => stand.transactions.find((tx) => tx.id === 'initial-balance')?.createdAt;
    const neuerStart = !alt || startZeit(neu) !== startZeit(alt);
    const basis = neuerStart ? LEERER_FINANZSTAND : alt;
    const geprueft = neuerStart ? { ...neu, transactions: begrenzeStartbuchung(neu.transactions) } : neu;

    // Server-Gutschriften: höchstens, was der Server vergeben und der bisherige Stand noch nicht eingebucht hat
    const vergeben = (sql.serverGutschriften.get(konto.id) as { summe: number }).summe;
    const schonEingebucht = basis.transactions.filter((tx) => tx.kind === 'Einnahme' && istServerGutschrift(tx)).reduce((summe, tx) => summe + tx.amount, 0);
    const pruefung = pruefeGuthaben(basis, geprueft, {
      serverGutschriftenMax: Math.max(0, vergeben - schonEingebucht),
      devWerkzeuge: darfDevWerkzeuge(konto.rolle),
      kreditAuszahlungMax: erlaubteKreditAuszahlung(neuerStart ? null : alt, neu),
    });
    if (pruefung.erlaubtesGuthaben !== neu.balance) {
      sql.protokollieren.run('Guthaben korrigiert', konto.name,
        `${Math.round(neu.balance).toLocaleString('de-DE')} € ohne passende Buchungen – auf ${Math.round(pruefung.erlaubtesGuthaben).toLocaleString('de-DE')} € gesetzt`
        + (pruefung.nichtGedeckt > 0 ? ` (${Math.round(pruefung.nichtGedeckt).toLocaleString('de-DE')} € unbestätigte Zulagen/Korrekturen/Kredite)` : ''));
      neu.balance = pruefung.erlaubtesGuthaben;
    }
    // Unbestätigte Zulagen/Korrekturen/Kredite nicht speichern – sonst zählten sie beim nächsten Mal als „schon eingebucht“
    if (pruefung.ungedeckteIds.length > 0) neu.transactions = neu.transactions.filter((tx) => !pruefung.ungedeckteIds.includes(tx.id));
    if (alt && einnahmenAuffaellig(pruefung.neueEinnahmen, vergangeneMs)) {
      sql.protokollieren.run('Auffällige Einnahmen', konto.name, `${Math.round(pruefung.neueEinnahmen).toLocaleString('de-DE')} € seit dem letzten Speichern`);
    }

    // Ruf (Bestenliste): nur gültige Zahlen im erlaubten Bereich
    if (neu.ruf !== undefined) {
      neu.ruf = typeof neu.ruf === 'number' && Number.isFinite(neu.ruf) ? Math.min(RUF_CONFIG.max, Math.max(RUF_CONFIG.min, neu.ruf)) : RUF_CONFIG.start;
    }

    // Fuhrpark und Wachen für die Bestenliste: Der Server rechnet sie selbst aus und deckelt den Zuwachs.
    // Die Listen im Spielstand bleiben unangetastet – niemand verliert Fahrzeuge, nur die Rangliste bleibt sauber.
    const bestandAlt = alt && !neuerStart
      ? alt.bestenlisteWerte ?? { wachen: zaehleWachen(alt.locations), fahrzeuge: alt.vehicles.length }
      : { wachen: 0, fahrzeuge: 0 };
    const bestand = pruefeBestand(bestandAlt, { wachen: zaehleWachen(neu.locations), fahrzeuge: neu.vehicles.length }, vergangeneMs);
    if (bestand.gekappt) {
      sql.protokollieren.run('Fuhrpark korrigiert', konto.name,
        `${neu.vehicles.length} Fahrzeuge / ${zaehleWachen(neu.locations)} Wachen in zu kurzer Zeit – `
        + `in der Bestenliste zählen ${bestand.werte.fahrzeuge} Fahrzeuge / ${bestand.werte.wachen} Wachen`);
    }
    neu.bestenlisteWerte = bestand.werte;

    // Laufbahn (Bestenliste): Fehlt sie oder ist sie kaputt (z. B. EP als Text), gilt der bisherige Stand –
    // die Bestenliste liest den gespeicherten Text direkt aus und würde sonst auch "999999999" als Zahl werten
    const laufbahnBasis = neuerStart ? LAUFBAHN_START : (alt?.laufbahn ?? LAUFBAHN_START);
    if (!istGueltigeLaufbahn(neu.laufbahn)) neu.laufbahn = laufbahnBasis;
    // Team und Tester spielen mit Dev-Werkzeugen und zählen in der Bestenliste ohnehin nicht
    if (!darfDevWerkzeuge(konto.rolle)) {
      const laufbahn = pruefeLaufbahn(laufbahnBasis, neu.laufbahn, vergangeneMs);
      if (laufbahn.gekappt) {
        sql.protokollieren.run('Laufbahn korrigiert', konto.name,
          `${neu.laufbahn.xp.toLocaleString('de-DE')} EP / ${neu.laufbahn.einsaetze.toLocaleString('de-DE')} Einsätze in zu kurzer Zeit – auf `
          + `${laufbahn.laufbahn.xp.toLocaleString('de-DE')} EP / ${laufbahn.laufbahn.einsaetze.toLocaleString('de-DE')} Einsätze gesetzt`);
        neu.laufbahn = laufbahn.laufbahn;
      }
    }
  }

  router.use(express.json({ limit: SPIELSTAND_MAX_GROESSE }), ladeKonto(konten), nurAngemeldet);

  /** Team-Aufräumen: alte Einsätze raus (null = nichts zu tun) */
  const aufgeraeumt = (stand: Spielstand) => (einsaetzeAufraeumenBis ? entferneAlteEinsaetze(stand, einsaetzeAufraeumenBis) : null);

  router.get('/', (_req, res) => {
    const zeile = sql.laden.get(kontoId(res)) as { daten: string; standVersion: number } | undefined;
    const stand = zeile ? JSON.parse(zeile.daten) as Spielstand : null;
    const neu = stand && aufgeraeumt(stand);
    if (neu) sql.speichern.run(kontoId(res), JSON.stringify(neu));
    // `version` zählt jeden gespeicherten Stand. Das Spiel schickt sie beim Speichern zurück –
    // so merkt der Server, wenn inzwischen ein anderes Gerät gespeichert hat (siehe PUT).
    res.json({ spielstand: neu ?? stand, version: zeile ? zeile.standVersion + (neu ? 1 : 0) : 0 });
  });

  router.put('/', (req: Request, res) => {
    const id = kontoId(res);
    // Drosselung je Konto: Das Spiel speichert höchstens alle 3 Sekunden, hier sind kurze Spitzen erlaubt.
    // Schützt den Server davor, dass ein einzelnes Konto mit großen Ständen alle anderen ausbremst.
    const warten = speicherBremse.gesperrtFuer(String(id));
    if (warten > 0) {
      res.setHeader('Retry-After', String(warten));
      return void res.status(429).json({ fehler: 'Zu viele Speichervorgänge. Bitte kurz warten.' });
    }
    speicherBremse.merkeFehlversuch(String(id));

    // Das Spiel schickt den Stand entweder direkt oder als { spielstand, version } (mit Konflikterkennung)
    const mitVersion = istSpeicherAnfrage(req.body);
    const roh: unknown = mitVersion ? req.body.spielstand : req.body;

    // Grobe Formprüfung über dieselbe Funktion, mit der der Client lädt – kaputte Stände gar nicht erst speichern
    if (!migriereSpielstand(roh)) {
      return void res.status(400).json({ fehler: 'Ungültiger Spielstand.' });
    }
    const neu = roh as Spielstand;

    // Konflikt: Seit dem Laden hat ein anderes Gerät (oder ein anderer Tab) gespeichert.
    // Ohne Versionsangabe (älteres Spiel im Browser) wird wie bisher gespeichert.
    if (mitVersion) {
      const aktuell = (sql.version.get(id) as { standVersion: number } | undefined)?.standVersion ?? 0;
      if (req.body.version !== aktuell) {
        return void res.status(409).json({
          fehler: 'Dein Spielstand wurde auf einem anderen Gerät geändert.',
          version: aktuell,
        });
      }
    }

    pruefePlausibilitaet(res.locals.konto as Konto, neu);
    // Offenes Spiel mit alten Einsätzen: aufgeräumt speichern und das Spiel neu laden lassen
    const ohneAlte = aufgeraeumt(neu);
    sql.speichern.run(id, JSON.stringify(ohneAlte ?? neu));
    nachSpeichern?.(res.locals.konto as Konto, ohneAlte ?? neu);
    const version = (sql.version.get(id) as { standVersion: number }).standVersion;
    if (ohneAlte) return void res.json({ neuLaden: true, version });
    // Ohne Versionsangabe antwortet der Server wie bisher mit 204 (ältere Spiele im Browser)
    if (!mitVersion) return void res.status(204).end();
    res.json({ version });
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
