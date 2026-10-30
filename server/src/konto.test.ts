import { afterEach, describe, expect, it } from 'vitest';
import type { Mail, Mailversand } from './mail.js';
import { setzeRolle } from './rolleSetzen.js';
import { cookieAus, starteTestServer, testmail, type TestServer } from './testServer.js';

let server: TestServer;
afterEach(() => server?.beenden());

/** Mailversand, der die Mails nur sammelt */
const sammelnderMailversand = () => {
  const mails: Mail[] = [];
  const versand: Mailversand = { aktiv: true, async sende(mail) { mails.push(mail); } };
  return { mails, versand };
};

const post = (pfad: string, body?: unknown, cookie?: string) => server.anfrage('POST', '/auth' + pfad, { body, cookie });
const registriere = async (name: string, email = testmail(name)) => cookieAus(await post('/registrieren', { name, email, passwort: 'geheim123' }));
const linkToken = (text: string) => decodeURIComponent(/token=([^\s]+)/.exec(text)![1]);

describe('E-Mail bei der Registrierung', () => {
  it('ist Pflicht, wird klein gespeichert und darf nur einmal vorkommen', async () => {
    server = await starteTestServer();
    expect((await post('/registrieren', { name: 'Disponent', passwort: 'geheim123' })).status).toBe(400);
    expect((await post('/registrieren', { name: 'Disponent', email: 'kaputt', passwort: 'geheim123' })).status).toBe(400);

    const res = await post('/registrieren', { name: 'Disponent', email: ' Leitstelle.Disponent@Test.DE ', passwort: 'geheim123' });
    expect(res.status).toBe(201);
    expect((await res.json()).konto.email).toBe('leitstelle.disponent@test.de');

    const doppelt = await post('/registrieren', { name: 'Anderer', email: 'LEITSTELLE.disponent@test.DE', passwort: 'geheim123' });
    expect(doppelt.status).toBe(409);
    expect((await doppelt.json()).fehler).toMatch(/E-Mail/);
  });
});

describe('Eigenes Konto ändern', () => {
  it('E-Mail nur mit richtigem Passwort ändern, nicht auf eine fremde Adresse', async () => {
    server = await starteTestServer();
    const ich = await registriere('Disponent');
    await registriere('Gast');
    expect((await post('/email', { email: 'neu@test.de', passwort: 'falsch123' }, ich)).status).toBe(403);
    expect((await post('/email', { email: testmail('Gast'), passwort: 'geheim123' }, ich)).status).toBe(409);
    const ok = await post('/email', { email: 'neu@test.de', passwort: 'geheim123' }, ich);
    expect((await ok.json()).konto.email).toBe('neu@test.de');
  });

  it('Passwort ändern beendet die Sitzungen auf anderen Geräten, die eigene bleibt', async () => {
    server = await starteTestServer();
    const geraet1 = await registriere('Disponent');
    const geraet2 = cookieAus(await post('/anmelden', { name: 'Disponent', passwort: 'geheim123' }));
    expect((await post('/passwort', { altesPasswort: 'falsch123', neuesPasswort: 'neuesgeheim1' }, geraet1)).status).toBe(403);
    expect((await post('/passwort', { altesPasswort: 'geheim123', neuesPasswort: 'kurz' }, geraet1)).status).toBe(400);
    expect((await post('/passwort', { altesPasswort: 'geheim123', neuesPasswort: 'neuesgeheim1' }, geraet1)).status).toBe(204);

    expect((await server.anfrage('GET', '/auth/ich', { cookie: geraet1 })).status).toBe(200);
    expect((await server.anfrage('GET', '/auth/ich', { cookie: geraet2 })).status).toBe(401);
    expect((await post('/anmelden', { name: 'Disponent', passwort: 'neuesgeheim1' })).status).toBe(200);
  });
});

describe('Passwort vergessen', () => {
  it('ohne Mailversand: Funktion als aus gemeldet, Anfrage mit Hinweis abgelehnt', async () => {
    server = await starteTestServer();
    expect(await (await server.anfrage('GET', '/auth/funktionen')).json()).toEqual({ passwortVergessen: false });
    const res = await post('/passwort-vergessen', { email: 'x@test.de' });
    expect(res.status).toBe(503);
  });

  it('mit Mailversand: Link per Mail, neues Passwort setzen, Link nur einmal gültig', async () => {
    const { mails, versand } = sammelnderMailversand();
    server = await starteTestServer({ mailversand: versand, spielUrl: 'https://spiel.example' });
    const alteSitzung = await registriere('Disponent');

    // Unbekannte Adresse: gleiche Antwort, aber keine Mail
    const unbekannt = await post('/passwort-vergessen', { email: 'niemand@test.de' });
    const bekannt = await post('/passwort-vergessen', { email: testmail('Disponent').toUpperCase() });
    expect(await unbekannt.json()).toEqual(await bekannt.json());
    expect(mails).toHaveLength(1);
    expect(mails[0].an).toBe(testmail('Disponent'));
    expect(mails[0].text).toContain('https://spiel.example/passwort-zuruecksetzen?token=');

    const token = linkToken(mails[0].text);
    expect((await post('/passwort-zuruecksetzen', { token, passwort: 'kurz' })).status).toBe(400);
    const ok = await post('/passwort-zuruecksetzen', { token, passwort: 'neuesgeheim1' });
    expect(await ok.json()).toEqual({ name: 'Disponent' });

    expect((await post('/passwort-zuruecksetzen', { token, passwort: 'nochmal12345' })).status).toBe(400);
    expect((await server.anfrage('GET', '/auth/ich', { cookie: alteSitzung })).status).toBe(401);
    expect((await post('/anmelden', { name: 'Disponent', passwort: 'neuesgeheim1' })).status).toBe(200);
  });

  it('abgelaufene oder ausgedachte Links werden abgelehnt', async () => {
    server = await starteTestServer();
    await registriere('Disponent');
    expect((await post('/passwort-zuruecksetzen', { token: 'ausgedacht', passwort: 'neuesgeheim1' })).status).toBe(400);
    server.db.prepare("INSERT INTO passwort_tokens VALUES ('abgelaufen', 1, 0)").run();
    expect((await post('/passwort-zuruecksetzen', { token: 'abgelaufen', passwort: 'neuesgeheim1' })).status).toBe(400);
  });

  it('Team kann einen Link erzeugen und weitergeben (Rangordnung gilt)', async () => {
    server = await starteTestServer({ spielUrl: 'https://spiel.example' });
    const owner = await registriere('Amy');
    setzeRolle(server.db, 'Amy', 'owner');
    const spieler = await registriere('Disponent');
    const id = (server.db.prepare("SELECT id FROM benutzer WHERE name = 'Disponent'").get() as { id: number }).id;

    expect((await server.anfrage('POST', `/team/konten/${id}/passwort-link`, { cookie: spieler })).status).toBe(403);
    const res = await server.anfrage('POST', `/team/konten/${id}/passwort-link`, { cookie: owner });
    const { link } = await res.json();
    expect(link).toMatch(/^https:\/\/spiel\.example\/passwort-zuruecksetzen\?token=/);
    expect((await post('/passwort-zuruecksetzen', { token: linkToken(link), passwort: 'neuesgeheim1' })).status).toBe(200);
  });
});

describe('Rolle per Kommandozeile setzen', () => {
  it('macht ein Konto zum Owner und stuft andere Owner zu Spielern herab', async () => {
    server = await starteTestServer();
    await registriere('Testkonto');
    setzeRolle(server.db, 'Testkonto', 'owner'); // z. B. ein früher automatisch vergebener Owner
    await registriere('Amy.Projektleitung');
    const ergebnis = setzeRolle(server.db, 'amy.projektleitung', 'owner');
    expect(ergebnis).toEqual({ name: 'Amy.Projektleitung', rolle: 'owner', herabgestuft: ['Testkonto'] });
    const rollen = server.db.prepare('SELECT name, rolle FROM benutzer ORDER BY id').all();
    expect(rollen).toEqual([{ name: 'Testkonto', rolle: 'player' }, { name: 'Amy.Projektleitung', rolle: 'owner' }]);
    expect(() => setzeRolle(server.db, 'Niemand', 'owner')).toThrow(/Kein Konto/);
  });
});

describe('Öffentlicher Benutzername', () => {
  it('darf nicht der Teil der E-Mail vor dem @ sein', async () => {
    server = await starteTestServer();
    const res = await post('/registrieren', { name: 'Amy.Teichert', email: 'amy.teichert@test.de', passwort: 'geheim123' });
    expect(res.status).toBe(400);
    expect((await res.json()).fehler).toMatch(/öffentlich/);
    expect((await post('/registrieren', { name: 'Amy.Projektleitung', email: 'amy.teichert@test.de', passwort: 'geheim123' })).status).toBe(201);
  });
});

describe('Profil', () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64');
  const ich = async (cookie: string) => (await (await server.anfrage('GET', '/auth/ich', { cookie })).json()).konto;

  it('Spitzname und Vorlage setzen, Unbekanntes ablehnen', async () => {
    server = await starteTestServer();
    const cookie = await registriere('Disponent');
    expect((await post('/profil', { spitzname: 'gamer23 🚒', avatar: 'vorlage:fw-helm' }, cookie)).status).toBe(200);
    expect(await ich(cookie)).toMatchObject({ spitzname: 'gamer23 🚒', avatar: 'vorlage:fw-helm' });
    expect((await post('/profil', { spitzname: 'x'.repeat(25) }, cookie)).status).toBe(400);
    expect((await post('/profil', { spitzname: '<b>', avatar: null }, cookie)).status).toBe(400);
    expect((await post('/profil', { spitzname: '', avatar: 'bild:123' }, cookie)).status).toBe(400);
    expect((await post('/profil', { spitzname: '  ', avatar: null }, cookie)).status).toBe(200);
    expect(await ich(cookie)).toMatchObject({ spitzname: null, avatar: null });
  });

  it('Bild hochladen: nur echte Bilder, erst nach Freigabe für alle abrufbar, Team kann es entfernen', async () => {
    server = await starteTestServer();
    const owner = await registriere('Amy');
    setzeRolle(server.db, 'Amy', 'owner');
    const cookie = await registriere('Disponent');
    const fremder = await registriere('Fremder');
    const id = (server.db.prepare("SELECT id FROM benutzer WHERE name = 'Disponent'").get() as { id: number }).id;

    expect((await server.anfrage('PUT', '/auth/bild', { body: { daten: Buffer.from('<svg onload=x>').toString('base64') }, cookie })).status).toBe(400);
    expect((await server.anfrage('PUT', '/auth/bild', { body: { daten: PNG }, cookie })).status).toBe(200);
    const { avatar } = await ich(cookie);
    expect(avatar).toMatch(/^bild:\d+$/);

    // Vor der Freigabe: nur der Spieler selbst und das Team sehen das Bild
    expect((await server.anfrage('GET', `/auth/bild/${id}`)).status).toBe(404);
    expect((await server.anfrage('GET', `/auth/bild/${id}`, { cookie: fremder })).status).toBe(404);
    const eigenes = await server.anfrage('GET', `/auth/bild/${id}`, { cookie });
    expect(eigenes.status).toBe(200);
    expect(eigenes.headers.get('cache-control')).toBe('private, no-store');
    expect((await server.anfrage('GET', `/auth/bild/${id}`, { cookie: owner })).status).toBe(200);

    // Team sieht es in der Prüfliste und gibt es frei
    expect((await server.anfrage('GET', '/team/bilder', { cookie })).status).toBe(403);
    expect((await (await server.anfrage('GET', '/team/bilder', { cookie: owner })).json()).bilder).toMatchObject([{ id, name: 'Disponent' }]);
    expect((await server.anfrage('POST', `/team/konten/${id}/bild/freigeben`, { cookie })).status).toBe(403);
    const freigabe = await server.anfrage('POST', `/team/konten/${id}/bild/freigeben`, { cookie: owner });
    expect((await freigabe.json()).bilder).toEqual([]);
    const bild = await server.anfrage('GET', `/auth/bild/${id}`);
    expect(bild.headers.get('content-type')).toBe('image/png');
    expect(bild.headers.get('cache-control')).toBe('public, max-age=86400');
    // Spitzname ändern behält das Bild
    await post('/profil', { spitzname: 'Neu', avatar }, cookie);
    expect((await ich(cookie)).avatar).toBe(avatar);

    // Ein neues Bild muss wieder geprüft werden
    await server.anfrage('PUT', '/auth/bild', { body: { daten: PNG }, cookie });
    expect((await server.anfrage('GET', `/auth/bild/${id}`)).status).toBe(404);

    expect((await server.anfrage('DELETE', `/team/konten/${id}/bild`, { cookie })).status).toBe(403);
    expect((await server.anfrage('DELETE', `/team/konten/${id}/bild`, { cookie: owner })).status).toBe(200);
    expect((await ich(cookie)).avatar).toBeNull();
    expect((await server.anfrage('GET', `/auth/bild/${id}`)).status).toBe(404);
  });

  it('Benutzername ändern: mit Passwort, nur wenn frei, höchstens alle 30 Tage', async () => {
    server = await starteTestServer();
    await registriere('Belegt');
    const cookie = await registriere('Disponent');
    expect((await post('/name', { name: 'Neuer_Name', passwort: 'falsch123' }, cookie)).status).toBe(403);
    expect((await post('/name', { name: 'belegt', passwort: 'geheim123' }, cookie)).status).toBe(409);
    expect((await post('/name', { name: 'Neuer_Name', passwort: 'geheim123' }, cookie)).status).toBe(200);
    expect((await ich(cookie)).name).toBe('Neuer_Name');
    expect((await post('/anmelden', { name: 'Neuer_Name', passwort: 'geheim123' })).status).toBe(200);
    expect((await post('/name', { name: 'Noch_einer', passwort: 'geheim123' }, cookie)).status).toBe(429);
    server.db.prepare("UPDATE benutzer SET name_geaendert = '2020-01-01T00:00:00.000Z'").run();
    expect((await post('/name', { name: 'Noch_einer', passwort: 'geheim123' }, cookie)).status).toBe(200);
  });
});
