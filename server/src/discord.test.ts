import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNeuesSpiel, type Konto, type SpielEinsatz } from '@leitstellendispo/shared';
import { cookieAus, testmail, starteTestServer, type TestServer } from './testServer.js';
import { erstelleGrosseinsatzWaechter, istGrosseinsatz } from './discord.js';
import { erstelleEreignisse } from './ereignisse.js';
import { oeffneDatenbank } from './datenbank.js';

const TOKEN = 'geheimes-bot-token';
const BOT = { Authorization: `Bearer ${TOKEN}` };

/** Nachgebauter Discord-Bot: tauscht jeden Code gegen den Discord-Nutzer aus `naechsterNutzer` */
let botServer: Server;
let botAufrufe: Array<{ pfad: string; body: Record<string, string>; auth?: string }>;
let naechsterNutzer = { id: '111', name: 'amy' };

let server: TestServer;
let amy: string, gast: string;

const registriere = async (name: string) =>
  cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name, email: testmail(name), passwort: 'geheim123' } }));
const json = async (res: Response) => ({ status: res.status, daten: res.status === 204 ? null : await res.json() });

beforeEach(async () => {
  botAufrufe = [];
  botServer = createServer((req, res) => {
    let roh = '';
    req.on('data', (teil) => (roh += teil));
    req.on('end', () => {
      botAufrufe.push({ pfad: req.url!, body: JSON.parse(roh || '{}'), auth: req.headers.authorization });
      if (req.url === '/oauth') res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(naechsterNutzer));
      else res.writeHead(204).end();
    });
  }).listen(0);
  await new Promise<void>((fertig) => botServer.once('listening', fertig));
  const botUrl = `http://127.0.0.1:${(botServer.address() as AddressInfo).port}`;

  server = await starteTestServer({ discordClientId: '999', discordBotUrl: botUrl, botApiToken: TOKEN, spielUrl: 'https://spiel.test' });
  amy = await registriere('Amy');
  gast = await registriere('Gast');
});

afterEach(async () => {
  await server.beenden();
  await new Promise((fertig) => botServer.close(fertig));
});

/** Kompletter Ablauf „Mit Discord verknüpfen“ → Ziel der letzten Weiterleitung */
async function verknuepfe(cookie: string) {
  const start = await server.anfrage('GET', '/discord/verbinden', { cookie, weiterleitungFolgen: false });
  const discordUrl = new URL(start.headers.get('location')!);
  const state = discordUrl.searchParams.get('state')!;
  const zurueck = await server.anfrage('GET', `/discord/rueckkehr?code=abc&state=${state}`, { weiterleitungFolgen: false });
  return { discordUrl, ziel: zurueck.headers.get('location') };
}

describe('Mit Discord verknüpfen', () => {
  it('leitet zu Discord und verknüpft nach der Rückkehr das Konto', async () => {
    const { discordUrl, ziel } = await verknuepfe(amy);
    expect(discordUrl.origin).toBe('https://discord.com');
    expect(discordUrl.searchParams.get('client_id')).toBe('999');
    expect(discordUrl.searchParams.get('redirect_uri')).toBe('https://spiel.test/api/discord/rueckkehr');
    expect(ziel).toBe('https://spiel.test/?discord=verknuepft');

    // Der Bot bekommt Code + Rückkehr-Adresse (mit Token) und danach den Hinweis zum Rollen-Abgleich
    expect(botAufrufe[0]).toMatchObject({ pfad: '/oauth', body: { code: 'abc', redirectUri: 'https://spiel.test/api/discord/rueckkehr' }, auth: `Bearer ${TOKEN}` });
    await new Promise((r) => setTimeout(r, 50));
    expect(botAufrufe.map((a) => a.pfad)).toContain('/abgleich');

    const status = await json(await server.anfrage('GET', '/discord/status', { cookie: amy }));
    expect(status.daten).toEqual({ verfuegbar: true, verknuepft: true, name: 'amy' });
  });

  it('ohne Anmeldung zurück zum Spiel, ohne gültigen state kein Verknüpfen', async () => {
    const ohne = await server.anfrage('GET', '/discord/verbinden', { weiterleitungFolgen: false });
    expect(ohne.headers.get('location')).toBe('https://spiel.test/?discord=anmelden');
    const gefaelscht = await server.anfrage('GET', '/discord/rueckkehr?code=abc&state=falsch', { weiterleitungFolgen: false });
    expect(gefaelscht.headers.get('location')).toBe('https://spiel.test/?discord=abgelaufen');
    expect(botAufrufe).toHaveLength(0);
  });

  it('ein Discord-Konto gehört nur zu einem Spielkonto; Trennen gibt es wieder frei', async () => {
    await verknuepfe(amy);
    expect((await verknuepfe(gast)).ziel).toBe('https://spiel.test/?discord=vergeben');

    expect((await server.anfrage('POST', '/discord/trennen', { cookie: amy })).status).toBe(204);
    expect((await verknuepfe(gast)).ziel).toBe('https://spiel.test/?discord=verknuepft');
  });
});

describe('Schnittstelle für den Bot', () => {
  it('nur mit Token und nur direkt vom Server, nicht über nginx aus dem Internet', async () => {
    expect((await server.anfrage('GET', '/bot/uebersicht')).status).toBe(404);
    expect((await server.anfrage('GET', '/bot/uebersicht', { headers: { Authorization: 'Bearer falsch' } })).status).toBe(404);
    expect((await server.anfrage('GET', '/bot/uebersicht', { headers: { ...BOT, 'X-Forwarded-For': '203.0.113.5' } })).status).toBe(404);
    expect((await server.anfrage('GET', '/bot/uebersicht', { headers: BOT })).status).toBe(200);
  });

  it('ohne BOT_API_TOKEN ist die Schnittstelle aus', async () => {
    const ohne = await starteTestServer();
    expect((await ohne.anfrage('GET', '/bot/uebersicht', { headers: { Authorization: 'Bearer ' } })).status).toBe(404);
    await ohne.beenden();
  });

  it('Profil per Name oder Discord-ID mit Rang aus dem Spielstand', async () => {
    const stand = createNeuesSpiel();
    stand.laufbahn = { xp: 1500, einsaetze: 42, perfekt: 7, erfolge: ['a', 'b'] };
    await server.anfrage('PUT', '/spielstand', { body: stand, cookie: amy });
    await verknuepfe(amy);

    const perName = await json(await server.anfrage('GET', '/bot/spieler?name=amy', { headers: BOT }));
    expect(perName.daten.spieler).toMatchObject({ name: 'Amy', xp: 1500, einsaetze: 42, perfekt: 7, erfolge: 2, discordId: '111', online: true });
    expect(perName.daten.spieler.rang.name).toBe('Disponent');
    const perDiscord = await json(await server.anfrage('GET', '/bot/spieler?discord=111', { headers: BOT }));
    expect(perDiscord.daten.spieler.name).toBe('Amy');
    expect((await server.anfrage('GET', '/bot/spieler?name=niemand', { headers: BOT })).status).toBe(404);
  });

  it('Rangliste nach XP, ohne Dev-Konten und Gesperrte', async () => {
    const mitXp = (xp: number) => ({ ...createNeuesSpiel(), laufbahn: { xp, einsaetze: 0, perfekt: 0, erfolge: [] } });
    const dritter = await registriere('Dritter');
    await server.anfrage('PUT', '/spielstand', { body: mitXp(100), cookie: amy });
    await server.anfrage('PUT', '/spielstand', { body: mitXp(500), cookie: gast });
    await server.anfrage('PUT', '/spielstand', { body: mitXp(9000), cookie: dritter });
    server.db.prepare("UPDATE benutzer SET dev_markiert = 1 WHERE name = 'Dritter'").run();

    const { daten } = await json(await server.anfrage('GET', '/bot/rangliste', { headers: BOT }));
    expect(daten.rangliste.map((s: { name: string; platz: number }) => [s.platz, s.name])).toEqual([[1, 'Gast'], [2, 'Amy']]);
  });

  it('Sperren meldet sofort ab und landet im Protokoll; Team-Konten nicht', async () => {
    const res = await json(await server.anfrage('POST', '/bot/sperren', { headers: BOT, body: { name: 'Gast', gesperrt: true, von: 'Mod', grund: 'Spam' } }));
    expect(res.daten.spieler.gesperrt).toBe(true);
    expect((await server.anfrage('GET', '/spielstand', { cookie: gast })).status).toBe(401);
    expect(server.db.prepare('SELECT von_name, aktion, ziel_name, details FROM team_protokoll').get())
      .toEqual({ von_name: 'Mod (Discord)', aktion: 'Konto gesperrt', ziel_name: 'Gast', details: 'Spam' });

    server.db.prepare("UPDATE benutzer SET rolle = 'owner' WHERE name = 'Amy'").run();
    expect((await server.anfrage('POST', '/bot/sperren', { headers: BOT, body: { name: 'Amy', gesperrt: true } })).status).toBe(403);
  });

  it('/bug aus Discord wird eine Fehlermeldung; Meldungen aus dem Spiel werden Ereignisse', async () => {
    await server.anfrage('POST', '/bot/fehlermeldung', { headers: BOT, body: { name: 'jemand', text: 'Knopf geht nicht' } });
    expect(server.db.prepare('SELECT name, text FROM fehlermeldungen').get()).toEqual({ name: 'jemand (Discord)', text: 'Knopf geht nicht' });

    await server.anfrage('POST', '/fehlermeldung', { cookie: amy, body: { text: 'Karte bleibt weiß', kontext: {} } });
    const { daten } = await json(await server.anfrage('GET', '/bot/ereignisse?seit=0', { headers: BOT }));
    expect(daten.ereignisse).toHaveLength(1);
    expect(daten.ereignisse[0]).toMatchObject({ nr: 1, art: 'fehlermeldung', daten: { spieler: 'Amy', text: 'Karte bleibt weiß' } });
    expect((await json(await server.anfrage('GET', '/bot/ereignisse?seit=1', { headers: BOT }))).daten.ereignisse).toHaveLength(0);
  });

  it('Übersicht zählt Spieler online und verknüpfte Konten', async () => {
    await server.anfrage('PUT', '/spielstand', { body: createNeuesSpiel(), cookie: amy });
    await verknuepfe(gast);
    const { daten } = await json(await server.anfrage('GET', '/bot/uebersicht', { headers: BOT }));
    expect(daten).toMatchObject({ online: 1, konten: 2, verknuepft: 1 });
    expect(typeof daten.gestartet).toBe('string');
  });
});

describe('Großeinsätze', () => {
  const einsatz = (id: string, stichwort: string, fahrzeuge: number) =>
    ({ id, stichwort, meldebild: 'Test', address: 'Hauptstraße 1, Stuttgart', adresse: { strasse: 'Hauptstraße', ort: 'Stuttgart' },
      requiredVehicles: [{ id: 'x', category: 'RTW', amount: fahrzeuge }] }) as unknown as SpielEinsatz;

  it('MANV oder viele Fahrzeuge', () => {
    expect(istGrosseinsatz(einsatz('1', 'MANV 10', 2))).toBe(true);
    expect(istGrosseinsatz(einsatz('2', 'B 4', 8))).toBe(true);
    expect(istGrosseinsatz(einsatz('3', 'RD 1', 1))).toBe(false);
  });

  it('meldet nur neue Großeinsätze, beim ersten Speichern nach dem Start nichts', () => {
    const db = oeffneDatenbank(':memory:');
    const ereignisse = erstelleEreignisse();
    const waechter = erstelleGrosseinsatzWaechter(db, ereignisse);
    const konto = { id: 1, name: 'Amy' } as Konto;

    waechter(konto, [einsatz('alt', 'MANV 10', 2)]);
    expect(ereignisse.seit(0).ereignisse).toHaveLength(0);
    waechter(konto, [einsatz('alt', 'MANV 10', 2), einsatz('neu', 'B 5', 10), einsatz('klein', 'RD 1', 1)]);
    expect(ereignisse.seit(0).ereignisse.map((e) => e.daten)).toEqual([
      { spieler: 'Amy', discordId: null, stichwort: 'B 5', meldebild: 'Test', ort: 'Stuttgart' },
    ]);
    db.close();
  });
});
