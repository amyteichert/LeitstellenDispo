// Discord-Anbindung:
// 1. Spieler verknüpfen ihr Konto per „Mit Discord verknüpfen“ (Anmeldung bei Discord, OAuth2).
//    Den Code tauscht der Discord-Bot auf demselben Server ein – das Spiel selbst darf nicht ins Internet (Firewall).
// 2. Interne Schnittstelle für den Bot (/api/bot): Profile, Rangliste, Sperren, Ereignisse. Nur mit BOT_API_TOKEN.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { getNaechsterRang, getRang, type Konto, type Laufbahn, type SpielEinsatz } from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';
import { ladeKonto, nurAngemeldet, spielBasisUrl } from './auth.js';
import type { KontenDienst } from './konten.js';
import type { Ereignisse } from './ereignisse.js';

export interface DiscordOptionen {
  /** Application-ID des Discord-Bots (DISCORD_CLIENT_ID) */
  discordClientId?: string;
  /** Interne Adresse des Bots, z. B. http://127.0.0.1:3010 (DISCORD_BOT_URL) */
  discordBotUrl?: string;
  /** Gemeinsames Geheimnis zwischen Spiel und Bot (BOT_API_TOKEN) */
  botApiToken?: string;
  spielUrl?: string;
}

/** So lange gilt ein angefangenes „Mit Discord verknüpfen“ */
const VERKNUEPFEN_GUELTIG_MS = 10 * 60 * 1000;
/** Wer in dieser Zeit gespeichert hat (das Spiel speichert alle paar Sekunden), gilt als online */
const ONLINE_FENSTER_MS = 2 * 60 * 1000;
/** Ab so vielen angeforderten Fahrzeugen (oder bei MANV) gilt ein Einsatz als Großeinsatz */
const GROSSEINSATZ_AB_FAHRZEUGEN = 8;

interface SpielerZeile {
  id: number;
  name: string;
  spitzname: string | null;
  rolle: string;
  gesperrt: number;
  erstellt: string;
  discord_id: string | null;
  daten: string | null;
  aktualisiert: string | null;
}

const istOnline = (aktualisiert: string | null) => Boolean(aktualisiert && Date.now() - Date.parse(aktualisiert) < ONLINE_FENSTER_MS);

/** Laufbahn und Zahlen aus dem gespeicherten Spielstand (ohne Spielstand: alles 0) */
function zahlenAus(daten: string | null) {
  const s = daten ? (JSON.parse(daten) as { laufbahn?: Laufbahn; vehicles?: unknown[]; locations?: Array<{ type?: string }>; ruf?: number }) : {};
  const laufbahn = s.laufbahn ?? { xp: 0, einsaetze: 0, perfekt: 0, erfolge: [] };
  return {
    xp: laufbahn.xp,
    einsaetze: laufbahn.einsaetze,
    perfekt: laufbahn.perfekt,
    erfolge: laufbahn.erfolge.length,
    fahrzeuge: s.vehicles?.length ?? 0,
    wachen: s.locations?.filter((l) => l?.type === 'station').length ?? 0,
    ruf: typeof s.ruf === 'number' ? Math.round(s.ruf) : null,
  };
}

export const istGrosseinsatz = (e: Pick<SpielEinsatz, 'stichwort' | 'requiredVehicles'>) =>
  e.stichwort.startsWith('MANV') || (e.requiredVehicles ?? []).reduce((summe, b) => summe + b.amount, 0) >= GROSSEINSATZ_AB_FAHRZEUGEN;

/** Merkt sich pro Konto die bekannten Einsätze und meldet neue Großeinsätze (beim ersten Speichern nach dem Start nur merken) */
export function erstelleGrosseinsatzWaechter(db: Datenbank, ereignisse: Ereignisse) {
  const bekannt = new Map<number, Set<string>>();
  const discordId = db.prepare('SELECT discord_id FROM benutzer WHERE id = ?');
  return (konto: Konto, einsaetze: SpielEinsatz[]) => {
    const vorher = bekannt.get(konto.id);
    bekannt.set(konto.id, new Set((einsaetze ?? []).map((e) => e.id)));
    if (!vorher) return;
    for (const e of einsaetze ?? []) {
      if (vorher.has(e.id) || !istGrosseinsatz(e)) continue;
      ereignisse.melde('grosseinsatz', {
        spieler: konto.name,
        discordId: (discordId.get(konto.id) as { discord_id: string | null } | undefined)?.discord_id ?? null,
        stichwort: e.stichwort,
        meldebild: e.meldebild,
        ort: e.adresse?.ort ?? e.address,
      });
    }
  };
}

/** Anfrage an den Discord-Bot (interne Adresse) */
async function anBot(optionen: DiscordOptionen, pfad: string, body: unknown) {
  const res = await fetch(`${optionen.discordBotUrl}${pfad}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${optionen.botApiToken}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Bot antwortet mit ${res.status}`);
  return res.status === 204 ? null : await res.json();
}

/** „Mit Discord verknüpfen“ für Spieler (/api/discord) */
export function erstelleDiscordRouter(db: Datenbank, konten: KontenDienst, optionen: DiscordOptionen): Router {
  const router = Router();
  const verfuegbar = Boolean(optionen.discordClientId && optionen.discordBotUrl && optionen.botApiToken);
  /** state → Konto, gegen gefälschte Rückkehr-Links (CSRF) */
  const offen = new Map<string, { kontoId: number; ablauf: number }>();
  const sql = {
    status: db.prepare('SELECT discord_name FROM benutzer WHERE id = ? AND discord_id IS NOT NULL'),
    vergebenAn: db.prepare('SELECT id FROM benutzer WHERE discord_id = ?'),
    verknuepfen: db.prepare('UPDATE benutzer SET discord_id = ?, discord_name = ? WHERE id = ?'),
    discordId: db.prepare('SELECT discord_id FROM benutzer WHERE id = ?'),
  };
  const rueckkehrUrl = (req: Request) => `${spielBasisUrl(req, optionen.spielUrl)}/api/discord/rueckkehr`;
  const zumSpiel = (req: Request, res: Response, ergebnis: string) =>
    res.redirect(`${spielBasisUrl(req, optionen.spielUrl)}/?discord=${ergebnis}`);
  // Bot Bescheid sagen (Rolle „Disponent“ sofort vergeben/entfernen) – klappt das nicht, gleicht er es später selbst ab
  const botAbgleich = () => {
    anBot(optionen, '/abgleich', {}).catch((fehler) => console.error('Discord-Bot nicht erreichbar:', fehler.message));
  };

  router.get('/status', ladeKonto(konten), nurAngemeldet, (_req, res) => {
    const zeile = sql.status.get((res.locals.konto as Konto).id) as { discord_name: string | null } | undefined;
    res.json({ verfuegbar, verknuepft: Boolean(zeile), name: zeile?.discord_name ?? null });
  });

  // Startet die Anmeldung bei Discord (normaler Link, kein fetch – der Browser wird weitergeleitet)
  router.get('/verbinden', ladeKonto(konten), (req, res) => {
    const konto = res.locals.konto as Konto | null;
    if (!konto) return void zumSpiel(req, res, 'anmelden');
    if (!verfuegbar) return void zumSpiel(req, res, 'nicht-verfuegbar');
    const state = randomBytes(24).toString('hex');
    const jetzt = Date.now();
    for (const [schluessel, eintrag] of offen) if (eintrag.ablauf < jetzt) offen.delete(schluessel);
    offen.set(state, { kontoId: konto.id, ablauf: jetzt + VERKNUEPFEN_GUELTIG_MS });
    const ziel = new URL('https://discord.com/oauth2/authorize');
    ziel.search = new URLSearchParams({
      client_id: optionen.discordClientId!,
      response_type: 'code',
      scope: 'identify',
      redirect_uri: rueckkehrUrl(req),
      state,
      prompt: 'none',
    }).toString();
    res.redirect(ziel.toString());
  });

  // Discord schickt den Spieler hierher zurück
  router.get('/rueckkehr', async (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const eintrag = offen.get(state);
    offen.delete(state);
    if (!eintrag || eintrag.ablauf < Date.now()) return void zumSpiel(req, res, 'abgelaufen');
    if (!code) return void zumSpiel(req, res, 'abgebrochen'); // „Abbrechen“ bei Discord
    try {
      const nutzer = (await anBot(optionen, '/oauth', { code, redirectUri: rueckkehrUrl(req) })) as { id: string; name: string };
      const vergeben = sql.vergebenAn.get(nutzer.id) as { id: number } | undefined;
      if (vergeben && vergeben.id !== eintrag.kontoId) return void zumSpiel(req, res, 'vergeben');
      sql.verknuepfen.run(nutzer.id, nutzer.name, eintrag.kontoId);
      botAbgleich();
      zumSpiel(req, res, 'verknuepft');
    } catch (fehler) {
      console.error('Discord-Verknüpfung fehlgeschlagen:', (fehler as Error).message);
      zumSpiel(req, res, 'fehler');
    }
  });

  router.post('/trennen', ladeKonto(konten), nurAngemeldet, (_req, res) => {
    sql.verknuepfen.run(null, null, (res.locals.konto as Konto).id);
    if (verfuegbar) botAbgleich();
    res.status(204).end();
  });

  return router;
}

/** Nur der Bot: richtiges Token und direkt vom eigenen Rechner (nicht über nginx aus dem Internet) */
function nurBot(token: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    const erwartet = Buffer.from(`Bearer ${token ?? ''}`);
    const erhalten = Buffer.from(req.get('authorization') ?? '');
    const lokal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    if (!token || !lokal || erhalten.length !== erwartet.length || !timingSafeEqual(erhalten, erwartet)) {
      return void res.status(404).end(); // nach außen so tun, als gäbe es die Schnittstelle nicht
    }
    next();
  };
}

/** Interne Schnittstelle für den Discord-Bot (/api/bot) */
export function erstelleBotRouter(db: Datenbank, ereignisse: Ereignisse, optionen: DiscordOptionen): Router {
  const router = Router();
  router.use(nurBot(optionen.botApiToken));

  const SPIELER_SPALTEN = `b.id, b.name, b.spitzname, b.rolle, b.gesperrt, b.erstellt, b.discord_id, s.daten, s.aktualisiert
    FROM benutzer b LEFT JOIN spielstaende s ON s.benutzer_id = b.id`;
  const sql = {
    perDiscord: db.prepare(`SELECT ${SPIELER_SPALTEN} WHERE b.discord_id = ?`),
    perName: db.prepare(`SELECT ${SPIELER_SPALTEN} WHERE b.name = ? COLLATE NOCASE`),
    ranglisteKandidaten: db.prepare(`SELECT ${SPIELER_SPALTEN} WHERE b.dev_markiert = 0 AND b.gesperrt = 0 AND b.freigegeben = 1 AND s.daten IS NOT NULL`),
    verknuepfungen: db.prepare('SELECT discord_id AS discordId, name, gesperrt FROM benutzer WHERE discord_id IS NOT NULL'),
    online: db.prepare('SELECT COUNT(*) AS n FROM spielstaende WHERE aktualisiert > ?'),
    konten: db.prepare('SELECT COUNT(*) AS n, COUNT(discord_id) AS verknuepft FROM benutzer'),
    sperren: db.prepare('UPDATE benutzer SET gesperrt = ? WHERE id = ?'),
    sitzungenBeenden: db.prepare('DELETE FROM sitzungen WHERE benutzer_id = ?'),
    protokollieren: db.prepare('INSERT INTO team_protokoll (von_name, aktion, ziel_name, details) VALUES (?, ?, ?, ?)'),
    fehlermeldung: db.prepare('INSERT INTO fehlermeldungen (benutzer_id, name, text, kontext) VALUES (?, ?, ?, ?)'),
  };

  const spielerAus = (z: SpielerZeile) => {
    const zahlen = zahlenAus(z.daten);
    const rang = getRang(zahlen.xp);
    const naechster = getNaechsterRang(zahlen.xp);
    return {
      name: z.name,
      spitzname: z.spitzname,
      rolle: z.rolle,
      gesperrt: Boolean(z.gesperrt),
      erstellt: z.erstellt,
      discordId: z.discord_id,
      rang: { stufe: rang.stufe, name: rang.name, abXp: rang.abXp },
      naechsterRang: naechster ? { name: naechster.name, abXp: naechster.abXp } : null,
      ...zahlen,
      online: istOnline(z.aktualisiert),
      zuletzt: z.aktualisiert,
    };
  };

  const findeSpieler = (req: Request) => {
    const discord = typeof req.query.discord === 'string' ? req.query.discord : req.body?.discordId;
    const name = typeof req.query.name === 'string' ? req.query.name : req.body?.name;
    if (typeof discord === 'string' && discord) return sql.perDiscord.get(discord) as SpielerZeile | undefined;
    if (typeof name === 'string' && name) return sql.perName.get(name.trim()) as SpielerZeile | undefined;
    return undefined;
  };

  router.get('/spieler', (req, res) => {
    const zeile = findeSpieler(req);
    if (!zeile) return void res.status(404).json({ fehler: 'Spieler nicht gefunden.' });
    res.json({ spieler: spielerAus(zeile) });
  });

  // Rangliste nach XP – alle Spielstände zu lesen ist teuer, daher eine Minute zwischenspeichern
  let rangliste: { zeit: number; liste: ReturnType<typeof spielerAus>[] } | null = null;
  router.get('/rangliste', (req, res) => {
    if (!rangliste || Date.now() - rangliste.zeit > 60_000) {
      const alle = (sql.ranglisteKandidaten.all() as SpielerZeile[]).map(spielerAus).sort((a, b) => b.xp - a.xp);
      rangliste = { zeit: Date.now(), liste: alle };
    }
    const anzahl = Math.min(Math.max(Number(req.query.anzahl) || 10, 1), 25);
    res.json({ rangliste: rangliste.liste.slice(0, anzahl).map((s, i) => ({ platz: i + 1, ...s })), gesamt: rangliste.liste.length });
  });

  router.get('/uebersicht', (_req, res) => {
    const konten = sql.konten.get() as { n: number; verknuepft: number };
    const online = (sql.online.get(new Date(Date.now() - ONLINE_FENSTER_MS).toISOString()) as { n: number }).n;
    res.json({ online, konten: konten.n, verknuepft: konten.verknuepft, gestartet: ereignisse.gestartet });
  });

  router.get('/verknuepfungen', (_req, res) => {
    const zeilen = sql.verknuepfungen.all() as Array<{ discordId: string; name: string; gesperrt: number }>;
    res.json({ verknuepfungen: zeilen.map((z) => ({ ...z, gesperrt: Boolean(z.gesperrt) })) });
  });

  router.get('/ereignisse', (req, res) => {
    res.json(ereignisse.seit(Number(req.query.seit) || 0));
  });

  // Sperren/Entsperren aus Discord (/ban … spiel, /spielban) – wie im Team-Bereich: sofort abmelden, ins Protokoll
  router.post('/sperren', (req, res) => {
    const zeile = findeSpieler(req);
    if (!zeile) return void res.status(404).json({ fehler: 'Spieler nicht gefunden.' });
    if (zeile.rolle !== 'player' && zeile.rolle !== 'tester') return void res.status(403).json({ fehler: 'Team-Konten können nicht über Discord gesperrt werden.' });
    const gesperrt = req.body?.gesperrt === true;
    const von = typeof req.body?.von === 'string' ? req.body.von.slice(0, 100) : 'Discord';
    const grund = typeof req.body?.grund === 'string' ? req.body.grund.slice(0, 500) : null;
    db.transaction(() => {
      sql.sperren.run(gesperrt ? 1 : 0, zeile.id);
      if (gesperrt) sql.sitzungenBeenden.run(zeile.id);
      sql.protokollieren.run(`${von} (Discord)`, gesperrt ? 'Konto gesperrt' : 'Konto entsperrt', zeile.name, grund);
    })();
    res.json({ spieler: spielerAus({ ...zeile, gesperrt: gesperrt ? 1 : 0 }) });
  });

  // /bug aus Discord landet bei den Fehlermeldungen im Team-Bereich
  router.post('/fehlermeldung', (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 2000) : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.slice(0, 100) : 'Discord';
    if (text.length < 5) return void res.status(400).json({ fehler: 'Text fehlt.' });
    const verknuepft = typeof req.body?.discordId === 'string' ? (sql.perDiscord.get(req.body.discordId) as SpielerZeile | undefined) : undefined;
    const kontext = { version: '', ansicht: 'Discord', geraet: 'Discord (/bug)', bildschirm: '', spielstand: null };
    sql.fehlermeldung.run(verknuepft?.id ?? null, verknuepft ? verknuepft.name : `${name} (Discord)`, text, JSON.stringify(kontext));
    res.status(201).json({ ok: true });
  });

  return router;
}
