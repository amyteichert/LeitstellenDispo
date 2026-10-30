import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cookieAus, starteTestServer, testmail, type TestServer } from './testServer.js';
import type { Mail } from './mail.js';

let server: TestServer;
let spieler: string;
let team: string;

beforeEach(async () => {
  server = await starteTestServer();
  const registriere = async (name: string) =>
    cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name, email: testmail(name), passwort: 'geheim123' } }));
  spieler = await registriere('Disponent');
  team = await registriere('Chefin');
  server.db.prepare("UPDATE benutzer SET rolle = 'owner' WHERE name = 'Chefin'").run();
});

afterEach(() => server.beenden());

const melden = (text: string, cookie?: string) =>
  server.anfrage('POST', '/fehlermeldung', { cookie, body: { text, kontext: { version: '0.1.0', ansicht: 'Karte', geraet: 'Test', bildschirm: '390x844' } } });

describe('Fehler melden', () => {
  it('speichert die Meldung mit Kontext, das Team sieht sie und kann sie erledigen', async () => {
    expect((await melden('Fahrzeug bleibt auf der Karte hängen', spieler)).status).toBe(201);

    const liste = await (await server.anfrage('GET', '/team/fehlermeldungen', { cookie: team })).json();
    expect(liste.meldungen).toHaveLength(1);
    expect(liste.meldungen[0]).toMatchObject({ name: 'Disponent', text: 'Fahrzeug bleibt auf der Karte hängen', erledigt: false, kontext: { ansicht: 'Karte', bildschirm: '390x844' } });

    const erledigt = await (await server.anfrage('POST', `/team/fehlermeldungen/${liste.meldungen[0].id}/erledigt`, { cookie: team, body: {} })).json();
    expect(erledigt.meldungen[0].erledigt).toBe(true);
  });

  it('lehnt leere Meldungen, Gäste ohne Konto und zu viele Meldungen ab', async () => {
    expect((await melden('', spieler)).status).toBe(400);
    expect((await melden('Ohne Anmeldung gemeldet')).status).toBe(401);
    for (let i = 0; i < 5; i++) await melden(`Meldung Nummer ${i}`, spieler);
    expect((await melden('Eine Meldung zu viel', spieler)).status).toBe(429);
  });

  it('ist für normale Spieler nicht einsehbar', async () => {
    expect((await server.anfrage('GET', '/team/fehlermeldungen', { cookie: spieler })).status).toBe(403);
  });
});

describe('Fehler melden – Mail an den Owner', () => {
  it('schickt jedem Owner eine Mail mit dem Text der Meldung, sonst niemandem', async () => {
    await server.beenden();
    const mails: Mail[] = [];
    server = await starteTestServer({ mailversand: { aktiv: true, async sende(mail) { mails.push(mail); } }, spielUrl: 'https://spiel.example' });
    const registriere = async (name: string) =>
      cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name, email: testmail(name), passwort: 'geheim123' } }));
    spieler = await registriere('Disponent');
    await registriere('Chefin');
    server.db.prepare("UPDATE benutzer SET rolle = 'owner' WHERE name = 'Chefin'").run();

    expect((await melden('Fahrzeug bleibt auf der Karte hängen', spieler)).status).toBe(201);
    await new Promise((fertig) => setTimeout(fertig, 10));

    expect(mails).toHaveLength(1);
    expect(mails[0].an).toBe(testmail('Chefin'));
    expect(mails[0].betreff).toBe('Neue Meldung von Disponent');
    expect(mails[0].text).toContain('Fahrzeug bleibt auf der Karte hängen');
    expect(mails[0].text).toContain('https://spiel.example');
  });
});
