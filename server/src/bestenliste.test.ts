import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNeuesSpiel, type BestenlisteAntwort, type MapLocation } from '@leitstellendispo/shared';
import { cookieAus, testmail, starteTestServer, type TestServer } from './testServer.js';

let server: TestServer;

beforeEach(async () => {
  server = await starteTestServer();
});

afterEach(() => server.beenden());

const registrieren = async (name: string) =>
  cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name, email: testmail(name), passwort: 'geheim123' } }));

const wache = (id: string): MapLocation => ({ id, name: id, type: 'station', stationKind: 'Rettungswache', coords: [48.77, 9.18], description: '', details: '' });

const speichern = (cookie: string, xp: number, extra: Record<string, unknown> = {}) =>
  server.anfrage('PUT', '/spielstand', {
    cookie,
    body: { ...createNeuesSpiel(), laufbahn: { xp, einsaetze: Math.round(xp / 10), perfekt: 0, erfolge: [] }, ...extra },
  });

const bestenliste = async (cookie: string, kategorie = 'xp') =>
  (await (await server.anfrage('GET', `/bestenliste?kategorie=${kategorie}`, { cookie })).json()) as BestenlisteAntwort;

describe('Bestenliste', () => {
  it('ist nur für angemeldete Spieler', async () => {
    expect((await server.anfrage('GET', '/bestenliste')).status).toBe(401);
  });

  it('zeigt Spieler nach Erfahrung, mit eigenem Platz', async () => {
    const anna = await registrieren('Anna');
    const ben = await registrieren('Ben');
    expect((await speichern(anna, 500)).status).toBe(204);
    expect((await speichern(ben, 900, { locations: [wache('w1'), wache('w2')] })).status).toBe(204);

    const liste = await bestenliste(anna);
    expect(liste.eintraege.map((e) => [e.konto.name, e.platz, e.werte.xp])).toEqual([['Ben', 1, 900], ['Anna', 2, 500]]);
    expect(liste.eintraege[0].werte.wachen).toBe(2);
    expect(liste.eigener?.platz).toBe(2);
    expect(liste.teilnehmer).toBe(2);
    // Keine privaten Daten
    expect(JSON.stringify(liste)).not.toContain('@');
  });

  it('bleibt beim erneuten Speichern und Löschen aktuell', async () => {
    const anna = await registrieren('Anna');
    await speichern(anna, 100);
    await speichern(anna, 250);
    expect((await bestenliste(anna)).eigener?.werte.xp).toBe(250);
    await server.anfrage('DELETE', '/spielstand', { cookie: anna });
    expect((await bestenliste(anna)).eigener).toBeNull();
  });

  it('lässt Konten mit Dev-Werkzeugen und gesperrte Konten weg', async () => {
    const anna = await registrieren('Anna');
    const ben = await registrieren('Ben');
    await speichern(anna, 100);
    await speichern(ben, 200);
    server.db.prepare("UPDATE benutzer SET dev_markiert = 1 WHERE name = 'Ben'").run();
    const liste = await bestenliste(anna);
    expect(liste.eintraege.map((e) => e.konto.name)).toEqual(['Anna']);
  });

  it('nimmt beim Anlegen der Tabelle vorhandene Spielstände mit', async () => {
    const anna = await registrieren('Anna');
    await speichern(anna, 300);
    server.db.prepare('DELETE FROM bestenliste').run();
    server.db.prepare('INSERT INTO bestenliste SELECT * FROM bestenliste_aus_spielstand').run();
    expect((await bestenliste(anna)).eigener?.werte.xp).toBe(300);
  });
});
