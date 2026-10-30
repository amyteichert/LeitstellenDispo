// Fahrzeuggrafik-Katalog: Spieler laden Bilder hoch, alle sehen und verwenden sie.
// Neue Grafiken sehen andere erst nach Freigabe durchs Team (wie bei Profilbildern).
// Löschen darf, wer sie hochgeladen hat, und jedes Team-Mitglied (unpassende Bilder).
import express, { Router } from 'express';
import {
  FAHRZEUGGRAFIK_MAX_BYTES,
  FAHRZEUGGRAFIKEN_JE_KONTO,
  anzeigeName,
  istTeamRolle,
  pruefeFahrzeuggrafik,
  type Fahrzeuggrafik,
  type Konto,
} from '@leitstellendispo/shared';
import { erkenneBildTyp, ladeKonto, nurAngemeldet } from './auth.js';
import type { Datenbank } from './datenbank.js';
import type { KontenDienst } from './konten.js';

interface GrafikZeile {
  id: number;
  name: string;
  fahrzeugTyp: string;
  vonName: string;
  vonId: number | null;
  erstellt: string;
  geprueft: number;
}

export function erstelleFahrzeuggrafikRouter(db: Datenbank, konten: KontenDienst): Router {
  const router = Router();
  // Base64 macht das Bild um ein Drittel größer – eigener Parser mit passendem Limit
  router.use(express.json({ limit: Math.ceil(FAHRZEUGGRAFIK_MAX_BYTES * 1.4) + 2000 }));

  // Anzeigename: aktueller Spitzname/Name des Kontos, nach dem Löschen der gespeicherte Name
  const sql = {
    liste: db.prepare(`
      SELECT g.id, g.name, g.fahrzeug_typ AS fahrzeugTyp, g.benutzer_id AS vonId, g.erstellt, g.geprueft,
             COALESCE(NULLIF(TRIM(b.spitzname), ''), b.name, g.von_name) AS vonName
      FROM fahrzeuggrafiken g LEFT JOIN benutzer b ON b.id = g.benutzer_id
      ORDER BY g.fahrzeug_typ, g.id DESC`),
    eintrag: db.prepare(`
      SELECT g.id, g.name, g.fahrzeug_typ AS fahrzeugTyp, g.benutzer_id AS vonId, g.erstellt, g.geprueft,
             COALESCE(NULLIF(TRIM(b.spitzname), ''), b.name, g.von_name) AS vonName
      FROM fahrzeuggrafiken g LEFT JOIN benutzer b ON b.id = g.benutzer_id WHERE g.id = ?`),
    bild: db.prepare('SELECT daten, typ, benutzer_id AS vonId, geprueft FROM fahrzeuggrafiken WHERE id = ?'),
    freigeben: db.prepare('UPDATE fahrzeuggrafiken SET geprueft = 1 WHERE id = ?'),
    anzahl: db.prepare('SELECT COUNT(*) AS n FROM fahrzeuggrafiken WHERE benutzer_id = ?'),
    anlegen: db.prepare('INSERT INTO fahrzeuggrafiken (benutzer_id, von_name, name, fahrzeug_typ, daten, typ) VALUES (?, ?, ?, ?, ?, ?)'),
    loeschen: db.prepare('DELETE FROM fahrzeuggrafiken WHERE id = ?'),
    protokollieren: db.prepare('INSERT INTO team_protokoll (von_name, aktion, ziel_name, details) VALUES (?, ?, ?, ?)'),
  };

  const zuGrafik = (z: GrafikZeile): Fahrzeuggrafik => ({ ...z, geprueft: Boolean(z.geprueft) });

  /** Darf dieses Konto eine (ungeprüfte) Grafik sehen? Geprüfte sehen alle. */
  const darfSehen = (grafik: { geprueft: number; vonId: number | null }, ich: Konto | null) =>
    Boolean(grafik.geprueft) || (ich !== null && (grafik.vonId === ich.id || istTeamRolle(ich.rolle)));

  /** Alle freigegebenen Grafiken (ohne Bilddaten), dazu die eigenen ungeprüften – das Team sieht alle */
  router.get('/', ladeKonto(konten), (_req, res) => {
    const ich = res.locals.konto as Konto | null;
    res.json({ grafiken: (sql.liste.all() as GrafikZeile[]).filter((g) => darfSehen(g, ich)).map(zuGrafik) });
  });

  router.get('/:id/bild', ladeKonto(konten), (req, res) => {
    const bild = sql.bild.get(Number(req.params.id)) as { daten: Buffer; typ: string; vonId: number | null; geprueft: number } | undefined;
    if (!bild || !darfSehen(bild, res.locals.konto as Konto | null)) return void res.status(404).end();
    res.setHeader('Content-Type', bild.typ);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    // Eine geprüfte Grafik ändert sich nie (nur löschen und neu hochladen) – darf lange im Cache bleiben.
    // Ungeprüfte nicht zwischenspeichern, sonst zeigt ein Proxy sie auch anderen.
    res.setHeader('Cache-Control', bild.geprueft ? 'public, max-age=604800, immutable' : 'private, no-store');
    res.send(bild.daten);
  });

  /** Team: Grafik freigeben – danach sehen sie alle */
  router.post('/:id/freigeben', ladeKonto(konten), nurAngemeldet, (req, res) => {
    const ich = res.locals.konto as Konto;
    if (!istTeamRolle(ich.rolle)) return void res.status(403).json({ fehler: 'Nur für das Team.' });
    const grafik = sql.eintrag.get(Number(req.params.id)) as GrafikZeile | undefined;
    if (!grafik) return void res.status(404).json({ fehler: 'Grafik nicht gefunden.' });
    sql.freigeben.run(grafik.id);
    sql.protokollieren.run(ich.name, 'Fahrzeuggrafik freigegeben', grafik.vonName, `${grafik.name} (${grafik.fahrzeugTyp})`);
    res.json({ grafik: zuGrafik(sql.eintrag.get(grafik.id) as GrafikZeile) });
  });

  router.post('/', ladeKonto(konten), nurAngemeldet, (req, res) => {
    const ich = res.locals.konto as Konto;
    const { name, fahrzeugTyp, daten: roh } = req.body ?? {};
    const fehler = pruefeFahrzeuggrafik(name, fahrzeugTyp);
    if (fehler) return void res.status(400).json({ fehler });
    if (typeof roh !== 'string') return void res.status(400).json({ fehler: 'Kein Bild.' });
    const daten = Buffer.from(roh, 'base64');
    if (daten.length === 0 || daten.length > FAHRZEUGGRAFIK_MAX_BYTES) return void res.status(400).json({ fehler: 'Das Bild ist zu groß.' });
    const typ = erkenneBildTyp(daten);
    if (!typ) return void res.status(400).json({ fehler: 'Nur JPG, PNG oder WebP.' });
    const { n } = sql.anzahl.get(ich.id) as { n: number };
    if (n >= FAHRZEUGGRAFIKEN_JE_KONTO) {
      return void res.status(400).json({ fehler: `Du hast schon ${FAHRZEUGGRAFIKEN_JE_KONTO} Grafiken hochgeladen. Lösche erst eine alte.` });
    }
    const { lastInsertRowid } = sql.anlegen.run(ich.id, anzeigeName(ich), (name as string).trim(), fahrzeugTyp, daten, typ);
    res.status(201).json({ grafik: zuGrafik(sql.eintrag.get(lastInsertRowid) as GrafikZeile) });
  });

  router.delete('/:id', ladeKonto(konten), nurAngemeldet, (req, res) => {
    const ich = res.locals.konto as Konto;
    const grafik = sql.eintrag.get(Number(req.params.id)) as GrafikZeile | undefined;
    if (!grafik) return void res.status(404).json({ fehler: 'Grafik nicht gefunden.' });
    const eigene = grafik.vonId === ich.id;
    if (!eigene && !istTeamRolle(ich.rolle)) return void res.status(403).json({ fehler: 'Du kannst nur deine eigenen Grafiken löschen.' });
    sql.loeschen.run(grafik.id);
    if (!eigene) sql.protokollieren.run(ich.name, 'Fahrzeuggrafik entfernt', grafik.vonName, `${grafik.name} (${grafik.fahrzeugTyp})`);
    res.status(204).end();
  });

  return router;
}
