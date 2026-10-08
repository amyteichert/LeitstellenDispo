import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Datenbank } from './datenbank.js';
import { cookieAus, starteTestServer, type TestServer } from './testServer.js';

let server: TestServer;
let db: Datenbank;

beforeEach(async () => {
  server = await starteTestServer();
  db = server.db;
});

afterEach(() => server.beenden());

const post = (pfad: string, body?: unknown, cookie?: string) => server.anfrage('POST', '/auth' + pfad, { body, cookie });
const ich = (cookie?: string) => server.anfrage('GET', '/auth/ich', { cookie });

describe('Registrieren', () => {
  it('macht das erste Konto zum Owner, alle weiteren zu Spielern', async () => {
    const erstes = await post('/registrieren', { name: 'Amy', passwort: 'geheim123' });
    expect(erstes.status).toBe(201);
    expect((await erstes.json()).konto).toMatchObject({ name: 'Amy', rolle: 'owner' });

    const zweites = await post('/registrieren', { name: 'Gast', passwort: 'geheim123' });
    expect((await zweites.json()).konto).toMatchObject({ name: 'Gast', rolle: 'player' });
  });

  it('meldet direkt an und setzt ein httpOnly-Cookie', async () => {
    const res = await post('/registrieren', { name: 'Amy', passwort: 'geheim123' });
    expect(res.headers.get('set-cookie')).toMatch(/ld_sitzung=.+HttpOnly/i);
    const antwort = await ich(cookieAus(res));
    expect(antwort.status).toBe(200);
    expect((await antwort.json()).konto.name).toBe('Amy');
  });

  it('lehnt doppelte Namen ohne Rücksicht auf Groß-/Kleinschreibung ab', async () => {
    await post('/registrieren', { name: 'Amy', passwort: 'geheim123' });
    const res = await post('/registrieren', { name: 'amy', passwort: 'anderes123' });
    expect(res.status).toBe(409);
  });

  it('prüft Name und Passwort', async () => {
    expect((await post('/registrieren', { name: 'A', passwort: 'geheim123' })).status).toBe(400);
    expect((await post('/registrieren', { name: 'Amy', passwort: 'kurz' })).status).toBe(400);
    expect((await post('/registrieren', {})).status).toBe(400);
  });

  it('speichert das Passwort nur als bcrypt-Hash', async () => {
    await post('/registrieren', { name: 'Amy', passwort: 'geheim123' });
    const zeile = db.prepare('SELECT passwort_hash FROM benutzer').get() as { passwort_hash: string };
    expect(zeile.passwort_hash).not.toContain('geheim123');
    expect(zeile.passwort_hash).toMatch(/^\$2[aby]\$/);
  });

  it('bremst nach 5 Registrierungen pro Stunde', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await post('/registrieren', { name: `Spieler${i}`, passwort: 'geheim123' })).status).toBe(201);
    }
    expect((await post('/registrieren', { name: 'Spieler9', passwort: 'geheim123' })).status).toBe(429);
  });
});

describe('Anmelden und Abmelden', () => {
  beforeEach(async () => {
    await post('/registrieren', { name: 'Amy', passwort: 'geheim123' });
  });

  it('meldet mit richtigen Daten an (Name ohne Groß-/Kleinschreibung)', async () => {
    const res = await post('/anmelden', { name: 'amy', passwort: 'geheim123' });
    expect(res.status).toBe(200);
    expect((await res.json()).konto).toMatchObject({ name: 'Amy', rolle: 'owner' });
    expect((await ich(cookieAus(res))).status).toBe(200);
  });

  it('gibt bei falschem Passwort und unbekanntem Namen dieselbe Antwort', async () => {
    const falsch = await post('/anmelden', { name: 'Amy', passwort: 'falsch123' });
    const unbekannt = await post('/anmelden', { name: 'Niemand', passwort: 'geheim123' });
    expect(falsch.status).toBe(401);
    expect(unbekannt.status).toBe(401);
    expect(await falsch.json()).toEqual(await unbekannt.json());
  });

  it('sperrt nach 10 Fehlversuchen vorübergehend', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await post('/anmelden', { name: 'Amy', passwort: 'falsch123' })).status).toBe(401);
    }
    const res = await post('/anmelden', { name: 'Amy', passwort: 'geheim123' });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('lässt gesperrte Konten nicht hinein und beendet ihre Sitzungen', async () => {
    const vorher = cookieAus(await post('/anmelden', { name: 'Amy', passwort: 'geheim123' }));
    db.prepare('UPDATE benutzer SET gesperrt = 1').run();
    expect((await post('/anmelden', { name: 'Amy', passwort: 'geheim123' })).status).toBe(403);
    expect((await ich(vorher)).status).toBe(401);
  });

  it('beendet die Sitzung beim Abmelden', async () => {
    const cookie = cookieAus(await post('/anmelden', { name: 'Amy', passwort: 'geheim123' }));
    expect((await post('/abmelden', undefined, cookie)).status).toBe(204);
    expect((await ich(cookie)).status).toBe(401);
  });

  it('antwortet ohne oder mit ungültigem Cookie mit 401', async () => {
    expect((await ich()).status).toBe(401);
    expect((await ich('ld_sitzung=ausgedacht')).status).toBe(401);
  });

  it('speichert Sitzungstokens nur gehasht', async () => {
    const cookie = cookieAus(await post('/anmelden', { name: 'Amy', passwort: 'geheim123' }));
    const token = cookie.split('=')[1];
    const treffer = db.prepare('SELECT COUNT(*) AS n FROM sitzungen WHERE token_hash = ?').get(token) as { n: number };
    expect(treffer.n).toBe(0);
  });
});
