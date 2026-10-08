import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNeuesSpiel } from '@leitstellendispo/shared';
import { cookieAus, starteTestServer, type TestServer } from './testServer.js';

let server: TestServer;
/** Cookies: erstes Konto = Owner, dann ein Admin und zwei Spieler */
let owner: string, admin: string, spieler: string, spieler2: string;
let ids: Record<string, number>;

const registriere = async (name: string) =>
  cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name, passwort: 'geheim123' } }));

beforeEach(async () => {
  server = await starteTestServer();
  owner = await registriere('Amy');
  admin = await registriere('Helfer');
  spieler = await registriere('Disponent');
  spieler2 = await registriere('Gast');
  ids = Object.fromEntries((server.db.prepare('SELECT id, name FROM benutzer').all() as Array<{ id: number; name: string }>).map((z) => [z.name, z.id]));
  server.db.prepare("UPDATE benutzer SET rolle = 'admin' WHERE name = 'Helfer'").run();
});

afterEach(() => server.beenden());

const json = async (res: Response) => ({ status: res.status, daten: res.status === 204 ? null : await res.json() });

describe('Zugang zum Team-Bereich', () => {
  it('nur für Team-Rollen, nicht für Spieler oder ohne Anmeldung', async () => {
    expect((await server.anfrage('GET', '/team/uebersicht', { cookie: owner })).status).toBe(200);
    expect((await server.anfrage('GET', '/team/uebersicht', { cookie: admin })).status).toBe(200);
    expect((await server.anfrage('GET', '/team/uebersicht', { cookie: spieler })).status).toBe(403);
    expect((await server.anfrage('GET', '/team/uebersicht')).status).toBe(401);
  });

  it('Übersicht zählt Konten, Team und aktive Spielstände', async () => {
    await server.anfrage('PUT', '/spielstand', { body: createNeuesSpiel(), cookie: spieler });
    const { daten } = await json(await server.anfrage('GET', '/team/uebersicht', { cookie: owner }));
    expect(daten.uebersicht).toMatchObject({ konten: 4, team: 2, gesperrt: 0, neuLetzte7Tage: 4, aktivHeute: 1, mitSpielstand: 1 });
  });
});

describe('Kontenverwaltung', () => {
  it('listet und sucht Konten', async () => {
    const alle = await json(await server.anfrage('GET', '/team/konten', { cookie: admin }));
    expect(alle.daten.konten.map((k: { name: string }) => k.name)).toEqual(['Amy', 'Helfer', 'Disponent', 'Gast']);
    const gefunden = await json(await server.anfrage('GET', '/team/konten?suche=disp', { cookie: admin }));
    expect(gefunden.daten.konten).toHaveLength(1);
    expect(gefunden.daten.konten[0]).not.toHaveProperty('passwort_hash');
  });

  it('Sperren meldet sofort ab und verhindert die Anmeldung; Entsperren hebt das auf', async () => {
    const res = await json(await server.anfrage('POST', `/team/konten/${ids.Disponent}/sperren`, { body: { gesperrt: true }, cookie: admin }));
    expect(res.daten.konto.gesperrt).toBe(true);
    expect((await server.anfrage('GET', '/spielstand', { cookie: spieler })).status).toBe(401);
    expect((await server.anfrage('POST', '/auth/anmelden', { body: { name: 'Disponent', passwort: 'geheim123' } })).status).toBe(403);

    await server.anfrage('POST', `/team/konten/${ids.Disponent}/sperren`, { body: { gesperrt: false }, cookie: admin });
    expect((await server.anfrage('POST', '/auth/anmelden', { body: { name: 'Disponent', passwort: 'geheim123' } })).status).toBe(200);
  });

  it('Rangordnung: Admin darf weder Owner noch sich selbst oder gleichrangige verwalten', async () => {
    expect((await server.anfrage('POST', `/team/konten/${ids.Amy}/sperren`, { body: { gesperrt: true }, cookie: admin })).status).toBe(403);
    expect((await server.anfrage('POST', `/team/konten/${ids.Helfer}/sperren`, { body: { gesperrt: true }, cookie: admin })).status).toBe(403);
    expect((await server.anfrage('DELETE', `/team/konten/${ids.Amy}`, { cookie: admin })).status).toBe(403);
    expect((await server.anfrage('DELETE', `/team/konten/${ids.Amy}`, { cookie: owner })).status).toBe(403); // nicht sich selbst
  });

  it('Rollen vergibt nur der Owner – nie die Owner-Rolle und nicht an sich selbst', async () => {
    expect((await server.anfrage('POST', `/team/konten/${ids.Disponent}/rolle`, { body: { rolle: 'admin' }, cookie: admin })).status).toBe(403);
    expect((await server.anfrage('POST', `/team/konten/${ids.Disponent}/rolle`, { body: { rolle: 'owner' }, cookie: owner })).status).toBe(403);
    expect((await server.anfrage('POST', `/team/konten/${ids.Amy}/rolle`, { body: { rolle: 'player' }, cookie: owner })).status).toBe(403);

    const res = await json(await server.anfrage('POST', `/team/konten/${ids.Disponent}/rolle`, { body: { rolle: 'co_owner' }, cookie: owner }));
    expect(res.daten.konto.rolle).toBe('co_owner');
    expect((await server.anfrage('GET', '/team/uebersicht', { cookie: spieler })).status).toBe(200);
  });

  it('Spielstand einsehen (Zusammenfassung) und zurücksetzen', async () => {
    await server.anfrage('PUT', '/spielstand', { body: { ...createNeuesSpiel(), balance: 4711 }, cookie: spieler });
    const ansicht = await json(await server.anfrage('GET', `/team/konten/${ids.Disponent}/spielstand`, { cookie: admin }));
    expect(ansicht.daten.zusammenfassung).toMatchObject({ guthaben: 4711, ruf: 50, wachen: 2, fahrzeuge: 1, personal: 2 });

    expect((await server.anfrage('DELETE', `/team/konten/${ids.Disponent}/spielstand`, { cookie: admin })).status).toBe(204);
    expect((await json(await server.anfrage('GET', '/spielstand', { cookie: spieler }))).daten.spielstand).toBeNull();
  });

  it('Löschen entfernt Konto, Sitzungen und Spielstand', async () => {
    await server.anfrage('PUT', '/spielstand', { body: createNeuesSpiel(), cookie: spieler2 });
    expect((await server.anfrage('DELETE', `/team/konten/${ids.Gast}`, { cookie: owner })).status).toBe(204);
    expect((await server.anfrage('GET', '/auth/ich', { cookie: spieler2 })).status).toBe(401);
    expect(server.db.prepare('SELECT COUNT(*) AS n FROM spielstaende').get()).toEqual({ n: 0 });
  });
});

describe('Dev-Markierung', () => {
  it('setzt das Team-Konto dauerhaft auf „mit Dev-Werkzeugen“, Spieler dürfen das nicht', async () => {
    expect((await server.anfrage('POST', '/team/dev-markierung', { cookie: spieler })).status).toBe(403);
    expect((await server.anfrage('POST', '/team/dev-markierung', { cookie: owner })).status).toBe(204);
    const { daten } = await json(await server.anfrage('GET', '/team/konten?suche=Amy', { cookie: owner }));
    expect(daten.konten[0].devMarkiert).toBe(true);
  });
});
