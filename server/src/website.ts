// Besucherstatistik der Website: Die Website meldet Seitenaufrufe anonym, der Owner sieht die Auswertung im Team-Bereich.
// Datenschutz: keine Cookies, keine IP-Adressen. Für „wie viele verschiedene Besucher“ wird aus IP + Browser-Kennung
// mit einem täglich neuen Zufallswert ein kurzer Code gebildet (nicht umkehrbar, am nächsten Tag nicht mehr zuordenbar).
import { createHash, randomBytes } from 'node:crypto';
import express, { Router, type Request } from 'express';
import {
  BESUCHS_ZIELE,
  WEBSITE_STATISTIK_CONFIG,
  bewerteBesuch,
  ordneQuelleEin,
  type BesuchsVerhalten,
  type BesuchsZiel,
  type QuellenArt,
  type WebsiteBereich,
  type WebsiteStatistik,
} from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';
import { erstelleFehlversuchBremse } from './fehlversuchBremse.js';

/** Eigene Adressen – Aufrufe von hier sind Weiterklicks innerhalb der Website */
const EIGENE_HOSTS = ['leitstellendispo.de'];
const INFO_WEBSITE = /^https?:\/\/(www\.)?leitstellendispo\.de(\/|$)/i;
/** Automatische Abrufe (Suchmaschinen-Crawler, Vorschau-Bilder in Messengern …) zählen nicht */
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp|embedly|curl|wget/i;

interface AufrufZeile {
  bereich: WebsiteBereich;
  tag: string;
  besucher: string;
  seite: string;
  quelle_art: QuellenArt;
  quelle_name: string | null;
  dauer_s: number;
  scroll: number;
  interaktion: number;
  ziel: BesuchsZiel | null;
}

/** Täglich neuer Zufallswert – nur im Arbeitsspeicher, damit Codes verschiedener Tage nie zusammenpassen */
function erstelleBesucherCode() {
  let tag = '';
  let salz = '';
  return (req: Request, jetzt: Date) => {
    const heute = jetzt.toISOString().slice(0, 10);
    if (heute !== tag) {
      tag = heute;
      salz = randomBytes(16).toString('hex');
    }
    return createHash('sha256').update(`${salz}|${req.ip ?? ''}|${req.get('user-agent') ?? ''}`).digest('hex').slice(0, 16);
  };
}

/** Die Website schickt Text (kein JSON-Content-Type), damit der Browser keine Vorab-Anfrage braucht */
const leseKoerper = (req: Request): Record<string, unknown> | null => {
  try {
    const daten = JSON.parse(typeof req.body === 'string' ? req.body : '');
    return daten && typeof daten === 'object' ? daten : null;
  } catch {
    return null;
  }
};

const zahl = (wert: unknown, max: number) => Math.min(max, Math.max(0, Math.round(Number(wert) || 0)));
const ID = /^[a-z0-9]{8,32}$/i;

export function erstelleWebsiteRouter(db: Datenbank): Router {
  const router = Router();
  const besucherCode = erstelleBesucherCode();
  // Schutz vor künstlich aufgeblähten Zahlen: höchstens 120 Meldungen je IP in 10 Minuten
  const bremse = erstelleFehlversuchBremse({ maxVersuche: 120, fensterMs: 10 * 60 * 1000 });
  const sql = {
    neu: db.prepare(`INSERT OR IGNORE INTO website_aufrufe (id, bereich, tag, besucher, seite, quelle_art, quelle_name) VALUES (?, ?, ?, ?, ?, ?, ?)`),
    ende: db.prepare(`
      UPDATE website_aufrufe SET
        dauer_s = MAX(dauer_s, ?), scroll = MAX(scroll, ?), interaktion = MAX(interaktion, ?), ziel = COALESCE(?, ziel)
      WHERE id = ? AND besucher = ?`),
    aufraeumen: db.prepare(`DELETE FROM website_aufrufe WHERE tag < ?`),
  };

  router.use(express.text({ type: '*/*', limit: '2kb' }));

  /** Gibt false zurück, wenn die Meldung nicht zählen soll (Bot oder zu viele Meldungen) */
  const zaehlt = (req: Request) => {
    if (BOT.test(req.get('user-agent') ?? '')) return false;
    const ip = req.ip ?? 'unbekannt';
    if (bremse.gesperrtFuer(ip) > 0) return false;
    bremse.merkeFehlversuch(ip);
    return true;
  };

  // Seitenaufruf: { id, bereich, seite, referrer, von }
  router.post('/aufruf', (req, res) => {
    const daten = leseKoerper(req);
    if (daten && zaehlt(req) && typeof daten.id === 'string' && ID.test(daten.id)) {
      const jetzt = new Date();
      const tag = jetzt.toISOString().slice(0, 10);
      const seite = typeof daten.seite === 'string' && daten.seite.startsWith('/') ? daten.seite.slice(0, 100) : '/';
      const referrer = typeof daten.referrer === 'string' ? daten.referrer.slice(0, 500) : null;
      const bereich: WebsiteBereich = daten.bereich === 'spiel' ? 'spiel' : 'info';
      // Ins Spiel über die Info-Website: als eigene Herkunft zeigen (sonst wäre es nur „intern“)
      const quelle = bereich === 'spiel' && referrer && INFO_WEBSITE.test(referrer)
        ? { art: 'link' as const, name: 'Info-Website' }
        : ordneQuelleEin(referrer, typeof daten.von === 'string' ? daten.von : null, EIGENE_HOSTS);
      sql.neu.run(daten.id, bereich, tag, besucherCode(req, jetzt), seite, quelle.art, quelle.name?.slice(0, 100) ?? null);
      // Gelegentlich alte Einträge löschen
      if (Math.random() < 0.01) {
        sql.aufraeumen.run(new Date(jetzt.getTime() - WEBSITE_STATISTIK_CONFIG.aufbewahrungTage * 86_400_000).toISOString().slice(0, 10));
      }
    }
    res.status(204).end();
  });

  // Ende des Aufrufs: { id, dauer, scroll, interaktion, ziel } – nur der eigene Aufruf (gleicher Besucher-Code) wird ergänzt
  router.post('/ende', (req, res) => {
    const daten = leseKoerper(req);
    if (daten && zaehlt(req) && typeof daten.id === 'string' && ID.test(daten.id)) {
      const ziel = (BESUCHS_ZIELE as readonly string[]).includes(daten.ziel as string) ? (daten.ziel as BesuchsZiel) : null;
      sql.ende.run(zahl(daten.dauer, 3600), zahl(daten.scroll, 100), daten.interaktion === true ? 1 : 0, ziel, daten.id, besucherCode(req, new Date()));
    }
    res.status(204).end();
  });

  return router;
}

/**
 * Auswertung der letzten `tage` Tage (null = alles) für den Team-Bereich.
 * `bereich` null = Info-Website und Spiel zusammen – dieselbe Person zählt dann einmal (gleicher Tages-Code).
 */
export function werteWebsiteAus(db: Datenbank, tage: number | null, bereich: WebsiteBereich | null = null, jetzt = new Date()): WebsiteStatistik {
  const ab = tage === null ? '0000-00-00' : new Date(jetzt.getTime() - (tage - 1) * 86_400_000).toISOString().slice(0, 10);
  const zeilen = db.prepare(`
    SELECT bereich, tag, besucher, seite, quelle_art, quelle_name, dauer_s, scroll, interaktion, ziel
    FROM website_aufrufe WHERE tag >= ? AND (? IS NULL OR bereich = ?) ORDER BY zeit`).all(ab, bereich, bereich) as AufrufZeile[];

  // Ein Besucher = gleicher Code am gleichen Tag
  const besuche = new Map<string, { zeilen: AufrufZeile[] }>();
  for (const zeile of zeilen) {
    const schluessel = `${zeile.tag}|${zeile.besucher}`;
    const besuch = besuche.get(schluessel) ?? { zeilen: [] };
    besuch.zeilen.push(zeile);
    besuche.set(schluessel, besuch);
  }

  const verhalten: Record<BesuchsVerhalten, number> = { interagiert: 0, gelesen: 0, kurz: 0 };
  const quellen = new Map<QuellenArt, number>();
  const herkuenfte = new Map<string, { art: QuellenArt; name: string; besucher: number }>();
  const ziele = new Map<BesuchsZiel, number>();
  for (const { zeilen: aufrufe } of besuche.values()) {
    verhalten[bewerteBesuch({
      dauerSekunden: aufrufe.reduce((summe, a) => summe + a.dauer_s, 0),
      scrollProzent: Math.max(...aufrufe.map((a) => a.scroll)),
      interaktion: aufrufe.some((a) => a.interaktion === 1),
    })]++;
    // Herkunft: erster Aufruf von außen (Weiterklicks innerhalb der Website zählen nicht als Herkunft)
    const einstieg = aufrufe.find((a) => a.quelle_art !== 'intern') ?? aufrufe[0];
    quellen.set(einstieg.quelle_art, (quellen.get(einstieg.quelle_art) ?? 0) + 1);
    if (einstieg.quelle_name) {
      const schluessel = `${einstieg.quelle_art}|${einstieg.quelle_name}`;
      const eintrag = herkuenfte.get(schluessel) ?? { art: einstieg.quelle_art, name: einstieg.quelle_name, besucher: 0 };
      eintrag.besucher++;
      herkuenfte.set(schluessel, eintrag);
    }
    for (const ziel of new Set(aufrufe.map((a) => a.ziel).filter((z): z is BesuchsZiel => z !== null))) {
      ziele.set(ziel, (ziele.get(ziel) ?? 0) + 1);
    }
  }

  const seiten = new Map<string, number>();
  const proTag = new Map<string, { aufrufe: number; besucher: Set<string> }>();
  for (const zeile of zeilen) {
    // Bei „beides“ die Seite mit Bereich kennzeichnen, sonst wären / der Info-Website und / des Spiels gleich
    const seite = bereich === null ? `${zeile.bereich === 'spiel' ? 'Spiel' : 'Info'}: ${zeile.seite}` : zeile.seite;
    seiten.set(seite, (seiten.get(seite) ?? 0) + 1);
    const tag = proTag.get(zeile.tag) ?? { aufrufe: 0, besucher: new Set<string>() };
    tag.aufrufe++;
    tag.besucher.add(zeile.besucher);
    proTag.set(zeile.tag, tag);
  }

  const absteigend = <T extends { besucher: number }>(a: T, b: T) => b.besucher - a.besucher;
  return {
    zeitraumTage: tage,
    bereich,
    aufrufe: zeilen.length,
    besucher: besuche.size,
    verhalten,
    quellen: [...quellen].map(([art, besucher]) => ({ art, besucher })).sort(absteigend),
    herkuenfte: [...herkuenfte.values()].sort(absteigend).slice(0, 20),
    seiten: [...seiten].map(([seite, aufrufe]) => ({ seite, aufrufe })).sort((a, b) => b.aufrufe - a.aufrufe),
    ziele: [...ziele].map(([ziel, besucher]) => ({ ziel, besucher })).sort(absteigend),
    tage: [...proTag].map(([tag, w]) => ({ tag, aufrufe: w.aufrufe, besucher: w.besucher.size })).sort((a, b) => a.tag.localeCompare(b.tag)),
  };
}
