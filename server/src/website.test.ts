import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cookieAus, testmail, starteTestServer, type TestServer } from './testServer.js';

let server: TestServer;
let owner: string, admin: string;

const registriere = async (name: string) =>
  cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name, email: testmail(name), passwort: 'geheim123' } }));

beforeEach(async () => {
  server = await starteTestServer();
  owner = await registriere('Amy');
  admin = await registriere('Helfer');
  server.db.prepare("UPDATE benutzer SET rolle = 'owner' WHERE name = 'Amy'").run();
  server.db.prepare("UPDATE benutzer SET rolle = 'admin' WHERE name = 'Helfer'").run();
});

afterEach(() => server.beenden());

const aufruf = (daten: Record<string, unknown>) => server.anfrage('POST', '/website/aufruf', { body: JSON.stringify(daten) });
const ende = (daten: Record<string, unknown>) => server.anfrage('POST', '/website/ende', { body: JSON.stringify(daten) });
const statistik = async (cookie: string) => (await (await server.anfrage('GET', '/team/website?tage=30', { cookie })).json()).statistik;

describe('Website-Statistik', () => {
  it('zählt Aufrufe, Besucher, Herkunft, Verhalten und Ziele', async () => {
    expect((await aufruf({ id: 'aaaaaaaa1', seite: '/index.html', referrer: 'https://www.google.de/' })).status).toBe(204);
    await ende({ id: 'aaaaaaaa1', dauer: 12, scroll: 30, interaktion: true, ziel: 'intern' });
    // Weiterklick auf der Website: gleicher Besucher, Herkunft bleibt Google
    await aufruf({ id: 'aaaaaaaa2', seite: '/funktionen.html', referrer: 'https://leitstellendispo.de/index.html' });
    await ende({ id: 'aaaaaaaa2', dauer: 40, scroll: 90, interaktion: true, ziel: 'spielen' });

    const s = await statistik(owner);
    expect(s.aufrufe).toBe(2);
    expect(s.besucher).toBe(1);
    expect(s.verhalten).toEqual({ interagiert: 1, gelesen: 0, kurz: 0 });
    expect(s.quellen).toEqual([{ art: 'suche', besucher: 1 }]);
    expect(s.herkuenfte).toEqual([{ art: 'suche', name: 'Google', besucher: 1 }]);
    expect(s.ziele.map((z: { ziel: string }) => z.ziel).sort()).toEqual(['intern', 'spielen']);
    expect(s.seiten).toHaveLength(2);
    expect(s.tage).toHaveLength(1);
  });

  it('?von=… zählt als geteilter Link; Bots und kaputte Meldungen werden ignoriert', async () => {
    await aufruf({ id: 'bbbbbbbb1', seite: '/', von: 'WhatsApp-Gruppe1' });
    await aufruf({ id: 'kurz', seite: '/' });
    await server.anfrage('POST', '/website/aufruf', { body: 'kein json' });
    const s = await statistik(owner);
    expect(s.aufrufe).toBe(1);
    expect(s.herkuenfte).toEqual([{ art: 'kampagne', name: 'whatsapp-gruppe1', besucher: 1 }]);
    expect(s.verhalten.kurz).toBe(1);
  });

  it('trennt Info-Website und Spiel – zusammen zählt dieselbe Person einmal', async () => {
    await aufruf({ id: 'cccccccc1', bereich: 'info', seite: '/', referrer: 'https://www.google.de/' });
    await ende({ id: 'cccccccc1', dauer: 20, scroll: 40, interaktion: true, ziel: 'spielen' });
    await aufruf({ id: 'cccccccc2', bereich: 'spiel', seite: '/', referrer: 'https://leitstellendispo.de/' });
    await ende({ id: 'cccccccc2', dauer: 90, interaktion: true, ziel: 'registriert' });

    const holen = async (bereich: string) =>
      (await (await server.anfrage('GET', `/team/website?tage=30&bereich=${bereich}`, { cookie: owner })).json()).statistik;
    const info = await holen('info');
    const spiel = await holen('spiel');
    const beide = await holen('beide');
    expect([info.bereich, info.aufrufe, info.besucher]).toEqual(['info', 1, 1]);
    expect([spiel.bereich, spiel.aufrufe, spiel.besucher]).toEqual(['spiel', 1, 1]);
    // Ins Spiel über die Info-Website
    expect(spiel.herkuenfte).toEqual([{ art: 'link', name: 'Info-Website', besucher: 1 }]);
    expect(spiel.ziele).toEqual([{ ziel: 'registriert', besucher: 1 }]);
    // Zusammen: eine Person, Herkunft ist der erste Einstieg (Google)
    expect([beide.bereich, beide.aufrufe, beide.besucher]).toEqual([null, 2, 1]);
    expect(beide.herkuenfte).toEqual([{ art: 'suche', name: 'Google', besucher: 1 }]);
    expect(beide.seiten.map((x: { seite: string }) => x.seite).sort()).toEqual(['Info: /', 'Spiel: /']);
  });

  it('die Auswertung sieht nur der Owner', async () => {
    expect((await server.anfrage('GET', '/team/website', { cookie: admin })).status).toBe(403);
    expect((await server.anfrage('GET', '/team/website', { cookie: owner })).status).toBe(200);
    expect((await server.anfrage('GET', '/team/website')).status).toBe(401);
  });
});
