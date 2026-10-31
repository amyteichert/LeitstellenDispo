import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Mail } from './mail.js';
import { erstelleKontenDienst, FREISCHALTUNG_FRIST_MS } from './konten.js';
import { cookieAus, testmail, starteTestServer, type TestServer } from './testServer.js';

let server: TestServer;
let mails: Mail[];
let owner: string;

const registriere = (name: string) =>
  server.anfrage('POST', '/auth/registrieren', { body: { name, email: testmail(name), passwort: 'geheim123' } });
const anmelden = (name: string) => server.anfrage('POST', '/auth/anmelden', { body: { name, passwort: 'geheim123' } });
const idVon = (name: string) => (server.db.prepare('SELECT id FROM benutzer WHERE name = ?').get(name) as { id: number }).id;

beforeEach(async () => {
  mails = [];
  server = await starteTestServer({
    freischaltungNoetig: true,
    mailversand: { aktiv: true, async sende(mail) { mails.push(mail); } },
    spielUrl: 'https://test.example',
  });
  // Owner gibt es auf der Testumgebung schon (per rolleSetzen) – hier direkt freigeschaltet anlegen
  await registriere('Amy');
  server.db.prepare("UPDATE benutzer SET rolle = 'owner', freigegeben = 1 WHERE name = 'Amy'").run();
  owner = cookieAus(await anmelden('Amy'));
  mails.length = 0;
});

afterEach(() => server.beenden());

describe('Freischaltung neuer Konten (KONTEN_FREISCHALTEN)', () => {
  it('neues Konto bekommt keine Sitzung, kann sich nicht anmelden und der Owner bekommt eine Mail', async () => {
    const res = await registriere('Fremder');
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ wartetAufFreischaltung: true });
    expect(res.headers.get('set-cookie')).toBeNull();

    const anmeldung = await anmelden('Fremder');
    expect(anmeldung.status).toBe(403);
    expect((await anmeldung.json()).fehler).toMatch(/Freischaltung/);

    expect(mails).toHaveLength(1);
    expect(mails[0].an).toBe(testmail('Amy'));
    expect(mails[0].betreff).toContain('Fremder');
  });

  it('Team sieht wartende Konten zuerst und kann sie freischalten', async () => {
    await registriere('Tester');
    const liste = await (await server.anfrage('GET', '/team/konten', { cookie: owner })).json();
    expect(liste.konten[0]).toMatchObject({ name: 'Tester', wartetAufFreischaltung: true });
    const uebersicht = await (await server.anfrage('GET', '/team/uebersicht', { cookie: owner })).json();
    expect(uebersicht.uebersicht.wartenAufFreischaltung).toBe(1);

    const frei = await server.anfrage('POST', `/team/konten/${idVon('Tester')}/freischalten`, { cookie: owner });
    expect(frei.status).toBe(200);
    expect((await frei.json()).konto.wartetAufFreischaltung).toBe(false);
    expect((await anmelden('Tester')).status).toBe(200);
    expect((await server.anfrage('POST', `/team/konten/${idVon('Tester')}/freischalten`, { cookie: owner })).status).toBe(409);
  });

  it('Spieler dürfen nicht freischalten', async () => {
    await registriere('Tester');
    await server.anfrage('POST', `/team/konten/${idVon('Tester')}/freischalten`, { cookie: owner });
    const tester = cookieAus(await anmelden('Tester'));
    await registriere('Fremder');
    expect((await server.anfrage('POST', `/team/konten/${idVon('Fremder')}/freischalten`, { cookie: tester })).status).toBe(403);
  });

  it('löscht nur Konten, die länger als 7 Tage warten, und protokolliert das', async () => {
    await registriere('Alt');
    await registriere('Neu');
    server.db.prepare("UPDATE benutzer SET erstellt = ? WHERE name = 'Alt'").run(new Date(Date.now() - FREISCHALTUNG_FRIST_MS - 60_000).toISOString());
    server.db.prepare("UPDATE benutzer SET erstellt = ? WHERE name = 'Amy'").run(new Date(Date.now() - 30 * FREISCHALTUNG_FRIST_MS).toISOString());

    expect(erstelleKontenDienst(server.db, { bcryptRunden: 4 }).loescheUnfreigegebene()).toEqual(['Alt']);
    const namen = (server.db.prepare('SELECT name FROM benutzer ORDER BY id').all() as Array<{ name: string }>).map((z) => z.name);
    expect(namen).toEqual(['Amy', 'Neu']);
    expect(server.db.prepare("SELECT von_name, ziel_name FROM team_protokoll WHERE aktion = 'Konto gelöscht'").get()).toEqual({ von_name: 'System', ziel_name: 'Alt' });
  });
});

describe('ohne KONTEN_FREISCHALTEN (spiel.leitstellendispo.de)', () => {
  it('neue Konten sind sofort nutzbar', async () => {
    const live = await starteTestServer();
    try {
      const res = await live.anfrage('POST', '/auth/registrieren', { body: { name: 'Spieler', email: testmail('Spieler'), passwort: 'geheim123' } });
      expect(res.status).toBe(201);
      expect(cookieAus(res)).toMatch(/^ld_sitzung=/);
    } finally {
      await live.beenden();
    }
  });
});
