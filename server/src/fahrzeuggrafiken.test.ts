import { afterEach, describe, expect, it } from 'vitest';
import { FAHRZEUGGRAFIK_MAX_BYTES } from '@leitstellendispo/shared';
import { setzeRolle } from './rolleSetzen.js';
import { cookieAus, starteTestServer, testmail, type TestServer } from './testServer.js';

let server: TestServer;
afterEach(() => server?.beenden());

/** Kleinstes gültiges PNG (1×1) */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const registriere = async (name: string) =>
  cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name, email: testmail(name), passwort: 'geheim123' } }));
const hochladen = (cookie: string | undefined, body: Record<string, unknown>) =>
  server.anfrage('POST', '/fahrzeuggrafiken', { body: { name: 'HLF 20 Wache 1', fahrzeugTyp: 'HLF 20', daten: PNG, ...body }, cookie });

describe('Fahrzeuggrafik-Katalog', () => {
  it('neue Grafiken sehen andere erst nach Freigabe durchs Team – dann alle, mit Name und Hochladendem', async () => {
    server = await starteTestServer();
    const amy = await registriere('Amy');
    const gast = await registriere('Gast');
    const mod = await registriere('Mod');
    setzeRolle(server.db, 'Mod', 'admin');
    const res = await hochladen(amy, {});
    expect(res.status).toBe(201);
    const { grafik } = await res.json();
    expect(grafik).toMatchObject({ name: 'HLF 20 Wache 1', fahrzeugTyp: 'HLF 20', vonName: 'Amy', geprueft: false });

    const ids = async (cookie?: string) =>
      (await (await server.anfrage('GET', '/fahrzeuggrafiken', { cookie })).json()).grafiken.map((g: { id: number }) => g.id);
    const bild = (cookie?: string) => server.anfrage('GET', `/fahrzeuggrafiken/${grafik.id}/bild`, { cookie });

    // Vor der Freigabe: nur Amy selbst und das Team
    expect(await ids(amy)).toEqual([grafik.id]);
    expect(await ids(mod)).toEqual([grafik.id]);
    expect(await ids(gast)).toEqual([]);
    expect(await ids()).toEqual([]);
    expect((await bild(gast)).status).toBe(404);
    expect((await bild(amy)).headers.get('cache-control')).toBe('private, no-store');

    // Freigeben darf nur das Team
    expect((await server.anfrage('POST', `/fahrzeuggrafiken/${grafik.id}/freigeben`, { cookie: amy })).status).toBe(403);
    expect((await server.anfrage('POST', `/fahrzeuggrafiken/${grafik.id}/freigeben`, { cookie: mod })).status).toBe(200);

    // Danach: für alle sichtbar, auch ohne Anmeldung
    expect(await ids()).toEqual([grafik.id]);
    const oeffentlich = await bild();
    expect(oeffentlich.headers.get('content-type')).toBe('image/png');
    expect(oeffentlich.headers.get('cache-control')).toContain('public');
  });

  it('prüft Anmeldung, Typ, Name und Bildformat', async () => {
    server = await starteTestServer();
    const amy = await registriere('Amy');
    expect((await hochladen(undefined, {})).status).toBe(401);
    expect((await hochladen(amy, { fahrzeugTyp: 'Raumschiff' })).status).toBe(400);
    expect((await hochladen(amy, { name: '  ' })).status).toBe(400);
    expect((await hochladen(amy, { daten: Buffer.from('<svg onload=alert(1)>').toString('base64') })).status).toBe(400);
    expect((await hochladen(amy, { daten: Buffer.alloc(FAHRZEUGGRAFIK_MAX_BYTES + 1).toString('base64') })).status).toBe(400);
  });

  it('löschen darf nur, wer sie hochgeladen hat – oder das Team', async () => {
    server = await starteTestServer();
    const amy = await registriere('Amy');
    const gast = await registriere('Gast');
    const mod = await registriere('Mod');
    setzeRolle(server.db, 'Mod', 'admin');
    const id = async () => (await (await hochladen(amy, {})).json()).grafik.id as number;

    const erste = await id();
    expect((await server.anfrage('DELETE', `/fahrzeuggrafiken/${erste}`, { cookie: gast })).status).toBe(403);
    expect((await server.anfrage('DELETE', `/fahrzeuggrafiken/${erste}`, { cookie: amy })).status).toBe(204);

    const zweite = await id();
    expect((await server.anfrage('DELETE', `/fahrzeuggrafiken/${zweite}`, { cookie: mod })).status).toBe(204);
    expect((await (await server.anfrage('GET', '/fahrzeuggrafiken')).json()).grafiken).toEqual([]);
  });
});
