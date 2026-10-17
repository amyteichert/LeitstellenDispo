import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNeuesSpiel, deutscherTag, vortag } from '@leitstellendispo/shared';
import { cookieAus, testmail, starteTestServer, type TestServer } from './testServer.js';

let server: TestServer;
let spieler: string;

beforeEach(async () => {
  server = await starteTestServer();
  spieler = cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name: 'Disponent', email: testmail('Disponent'), passwort: 'geheim123' } }));
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
    const gast = cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name: 'Gast', email: testmail('Gast'), passwort: 'geheim123' } }));
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

describe('Schichtzulage', () => {
  const abholen = (cookie?: string) => server.anfrage('POST', '/spielstand/schichtzulage', { cookie });
  const korrekturen = async () => (await (await server.anfrage('GET', '/spielstand/korrekturen', { cookie: spieler })).json()).korrekturen;
  const setzeLetztenTag = (tag: string, serie: number) =>
    server.db.prepare('UPDATE schichtzulage SET letzter_tag = ?, serie = ?').run(tag, serie);
  const heute = () => deutscherTag(Date.now());

  it('vergibt sie einmal pro Tag und legt sie als Gutschrift an', async () => {
    expect(await (await abholen(spieler)).json()).toEqual({ erhalten: true, betrag: 1000, serie: 1, morgen: 1500 });
    expect(await (await abholen(spieler)).json()).toEqual({ erhalten: false, serie: 1 });

    const offen = await korrekturen();
    expect(offen).toHaveLength(1);
    expect(offen[0]).toMatchObject({ guthabenAenderung: 1000, art: 'schichtzulage', grund: 'Schichtzulage – Tag 1 in Folge' });
  });

  it('zählt die Serie weiter und setzt nach einem verpassten Tag zurück', async () => {
    await abholen(spieler);
    setzeLetztenTag(vortag(heute()), 13);
    expect(await (await abholen(spieler)).json()).toMatchObject({ erhalten: true, betrag: 15_000, serie: 14 });

    setzeLetztenTag(vortag(vortag(heute())), 14);
    expect(await (await abholen(spieler)).json()).toMatchObject({ erhalten: true, betrag: 1000, serie: 1 });
  });

  it('gibt es nur mit Anmeldung', async () => {
    expect((await abholen()).status).toBe(401);
  });
});

describe('Schutz gegen Schummeln', () => {
  const protokoll = () => server.db.prepare("SELECT aktion, ziel_name AS ziel FROM team_protokoll WHERE von_name = 'System'").all();

  it('kürzt ein ohne Buchungen erhöhtes Guthaben beim Speichern und vermerkt es', async () => {
    const start = createNeuesSpiel();
    await speichern(start, spieler);
    await speichern({ ...start, balance: 999_999 }, spieler);
    expect((await (await laden(spieler)).json()).spielstand.balance).toBe(start.balance);
    expect(protokoll()).toEqual([{ aktion: 'Guthaben korrigiert', ziel: 'Disponent' }]);
  });

  it('lässt ehrliche Einnahmen und ein neues Spiel durch', async () => {
    const start = createNeuesSpiel();
    await speichern(start, spieler);
    const einnahme = { id: 'e1', kind: 'Einnahme' as const, label: 'RD 1 abgeschlossen', amount: 300, createdAt: new Date().toISOString() };
    await speichern({ ...start, balance: start.balance - 15_000 + 300, transactions: [einnahme, { ...einnahme, id: 'k1', kind: 'Ausgabe' as const, amount: 15_000 }, ...start.transactions] }, spieler);
    expect((await (await laden(spieler)).json()).spielstand.balance).toBe(start.balance - 14_700);

    const neuesSpiel = { ...createNeuesSpiel(), transactions: [{ ...start.transactions[0], createdAt: '2030-01-01T00:00:00.000Z' }] };
    await speichern(neuesSpiel, spieler);
    expect((await (await laden(spieler)).json()).spielstand.balance).toBe(neuesSpiel.balance);
    expect(protokoll()).toEqual([]);
  });
});
