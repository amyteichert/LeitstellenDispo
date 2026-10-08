import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNeuesSpiel } from '@leitstellendispo/shared';
import { cookieAus, starteTestServer, type TestServer } from './testServer.js';

let server: TestServer;
let spieler: string;

beforeEach(async () => {
  server = await starteTestServer();
  spieler = cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name: 'Disponent', passwort: 'geheim123' } }));
});

afterEach(() => server.beenden());

const laden = (cookie?: string) => server.anfrage('GET', '/spielstand', { cookie });
const speichern = (body: unknown, cookie?: string) => server.anfrage('PUT', '/spielstand', { body, cookie });

describe('Spielstand pro Konto', () => {
  it('ist für ein neues Konto leer', async () => {
    const res = await laden(spieler);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ spielstand: null });
  });

  it('speichert und lädt den Spielstand', async () => {
    const spielstand = { ...createNeuesSpiel(), balance: 4711 };
    expect((await speichern(spielstand, spieler)).status).toBe(204);
    expect((await (await laden(spieler)).json()).spielstand).toEqual(spielstand);

    // Zweites Speichern überschreibt
    expect((await speichern({ ...spielstand, balance: 1 }, spieler)).status).toBe(204);
    expect((await (await laden(spieler)).json()).spielstand.balance).toBe(1);
  });

  it('trennt die Spielstände verschiedener Konten', async () => {
    const gast = cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name: 'Gast', passwort: 'geheim123' } }));
    await speichern({ ...createNeuesSpiel(), balance: 4711 }, spieler);
    expect((await (await laden(gast)).json()).spielstand).toBeNull();
  });

  it('löscht den Spielstand', async () => {
    await speichern(createNeuesSpiel(), spieler);
    expect((await server.anfrage('DELETE', '/spielstand', { cookie: spieler })).status).toBe(204);
    expect((await (await laden(spieler)).json()).spielstand).toBeNull();
  });

  it('verlangt eine Anmeldung', async () => {
    expect((await laden()).status).toBe(401);
    expect((await speichern(createNeuesSpiel())).status).toBe(401);
  });

  it('lehnt kaputte Spielstände und kaputtes JSON ab', async () => {
    expect((await speichern({ balance: 5 }, spieler)).status).toBe(400);
    expect((await speichern('{kaputt', spieler)).status).toBe(400);
  });

  it('nimmt auch große Spielstände an (über 100 kB)', async () => {
    const gross = { ...createNeuesSpiel(), notiz: 'x'.repeat(500_000) };
    expect((await speichern(gross, spieler)).status).toBe(204);
  });

  it('lehnt zu große Anfragen mit 413 ab', async () => {
    const zuGross = { ...createNeuesSpiel(), notiz: 'x'.repeat(6_000_000) };
    expect((await speichern(zuGross, spieler)).status).toBe(413);
  });
});
