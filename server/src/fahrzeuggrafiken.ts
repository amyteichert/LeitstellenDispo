// Fahrzeuggrafik-Katalog: Spieler laden Bilder hoch, alle sehen und verwenden sie.
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
}

export function erstelleFahrzeuggrafikRouter(db: Datenbank, konten: KontenDienst): Router {
  const router = Router();
  // Base64 macht das Bild um ein Drittel größer – eigener Parser mit passendem Limit
  router.use(express.json({ limit: Math.ceil(FAHRZEUGGRAFIK_MAX_BYTES * 1.4) + 2000 }));

  // Anzeigename: aktueller Spitzname/Name des Kontos, nach dem Löschen der gespeicherte Name
  const sql = {
    liste: db.prepare(`
      SELECT g.id, g.name, g.fahrzeug_typ AS fahrzeugTyp, g.benutzer_id AS vonId, g.erstellt,
             COALESCE(NULLIF(TRIM(b.spitzname), ''), b.name, g.von_name) AS vonName
      FROM fahrzeuggrafiken g LEFT JOIN benutzer b ON b.id = g.benutzer_id
      ORDER BY g.fahrzeug_typ, g.id DESC`),
    eintrag: db.prepare(`
      SELECT g.id, g.name, g.fahrzeug_typ AS fahrzeugTyp, g.benutzer_id AS vonId, g.erstellt,
             COALESCE(NULLIF(TRIM(b.spitzname), ''), b.name, g.von_name) AS vonName
      FROM fahrzeuggrafiken g LEFT JOIN benutzer b ON b.id = g.benutzer_id WHERE g.id = ?`),
    bild: db.prepare('SELECT daten, typ FROM fahrzeuggrafiken WHERE id = ?'),
    anzahl: db.prepare('SELECT COUNT(*) AS n FROM fahrzeuggrafiken WHERE benutzer_id = ?'),
    anlegen: db.prepare('INSERT INTO fahrzeuggrafiken (benutzer_id, von_name, name, fahrzeug_typ, daten, typ) VALUES (?, ?, ?, ?, ?, ?)'),
    loeschen: db.prepare('DELETE FROM fahrzeuggrafiken WHERE id = ?'),
    protokollieren: db.prepare('INSERT INTO team_protokoll (von_name, aktion, ziel_name, details) VALUES (?, ?, ?, ?)'),
  };

  const zuGrafik = (z: GrafikZeile): Fahrzeuggrafik => ({ ...z });

  /** Alle Grafiken (ohne Bilddaten) – für alle sichtbar */
  router.get('/', (_req, res) => {
    res.json({ grafiken: (sql.liste.all() as GrafikZeile[]).map(zuGrafik) });
  });

  router.get('/:id/bild', (req, res) => {
    const bild = sql.bild.get(Number(req.params.id)) as { daten: Buffer; typ: string } | undefined;
    if (!bild) return void res.status(404).end();
    res.setHeader('Content-Type', bild.typ);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    // Eine Grafik ändert sich nie (nur löschen und neu hochladen) – darf lange im Cache bleiben
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.send(bild.daten);
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
