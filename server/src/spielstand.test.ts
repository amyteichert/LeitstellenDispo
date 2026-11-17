import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLAUSIBILITAET, createNeuesSpiel, deutscherTag, vortag } from '@leitstellendispo/shared';
import { cookieAus, testmail, starteTestServer, type TestServer } from './testServer.js';
import { SPEICHERN_MAX_PRO_FENSTER } from './spielstand.js';

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
    expect(await res.json()).toMatchObject({ spielstand: null });
  });

  it('speichert und lädt den Spielstand', async () => {
    const spielstand = { ...createNeuesSpiel(), balance: 4711 };
    expect((await speichern(spielstand, spieler)).status).toBe(204);
    // Der Server ergänzt die geprüften Bestenlisten-Werte, sonst bleibt der Stand unverändert
    expect((await (await laden(spieler)).json()).spielstand).toEqual({ ...spielstand, bestenlisteWerte: { wachen: 0, fahrzeuge: 0 } });

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

describe('Zwei Geräte: Versionsprüfung beim Speichern (QA-05)', () => {
  const ladenMitVersion = async () => (await (await laden(spieler)).json()) as { spielstand: unknown; version: number };

  it('gibt beim Laden eine Version mit und zählt sie bei jedem Speichern hoch', async () => {
    expect((await ladenMitVersion()).version).toBe(0);
    await speichern(createNeuesSpiel(), spieler);
    expect((await ladenMitVersion()).version).toBe(1);
    await speichern(createNeuesSpiel(), spieler);
    expect((await ladenMitVersion()).version).toBe(2);
  });

  it('lehnt das Speichern mit veralteter Version ab (409) und behält den neueren Stand', async () => {
    const start = createNeuesSpiel();
    await speichern(start, spieler);
    // Gerät A und Gerät B laden denselben Stand
    const geraetA = (await ladenMitVersion()).version;
    const geraetB = geraetA;

    // Gerät A speichert zuerst
    const a = await server.anfrage('PUT', '/spielstand', { body: { spielstand: { ...start, balance: 19_000 }, version: geraetA }, cookie: spieler });
    expect(a.status).toBe(200);
    expect(await a.json()).toMatchObject({ version: geraetA + 1 });

    // Gerät B hat den alten Stand und darf ihn nicht mehr überschreiben
    const b = await server.anfrage('PUT', '/spielstand', { body: { spielstand: { ...start, balance: 18_000 }, version: geraetB }, cookie: spieler });
    expect(b.status).toBe(409);
    expect(await b.json()).toMatchObject({ version: geraetA + 1 });
    expect((await (await laden(spieler)).json()).spielstand.balance).toBe(19_000);

    // Nach dem Neuladen darf Gerät B wieder speichern
    const frisch = await ladenMitVersion();
    const c = await server.anfrage('PUT', '/spielstand', { body: { spielstand: { ...start, balance: 17_000 }, version: frisch.version }, cookie: spieler });
    expect(c.status).toBe(200);
    expect((await (await laden(spieler)).json()).spielstand.balance).toBe(17_000);
  });

  it('speichert ohne Versionsangabe weiterhin (älteres Spiel im Browser nach einem Deployment)', async () => {
    const start = createNeuesSpiel();
    expect((await speichern(start, spieler)).status).toBe(204);
    expect((await speichern({ ...start, balance: 4711 }, spieler)).status).toBe(204);
    expect((await (await laden(spieler)).json()).spielstand.balance).toBe(4711);
  });

  it('trennt die Versionen verschiedener Konten', async () => {
    const gast = cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name: 'Gast', email: testmail('Gast'), passwort: 'geheim123' } }));
    await speichern(createNeuesSpiel(), spieler);
    await speichern(createNeuesSpiel(), spieler);
    expect((await (await laden(gast)).json()).version).toBe(0);
    const eigener = await server.anfrage('PUT', '/spielstand', { body: { spielstand: createNeuesSpiel(), version: 0 }, cookie: gast });
    expect(eigener.status).toBe(200);
  });
});

describe('Drosselung der Speichervorgänge je Konto (QA-06)', () => {
  it('bremst ein flutendes Konto mit 429, ohne andere Konten zu behindern', async () => {
    const stand = createNeuesSpiel();
    let gebremst = 0;
    for (let i = 0; i < SPEICHERN_MAX_PRO_FENSTER + 5; i++) {
      const res = await speichern(stand, spieler);
      if (res.status === 429) {
        gebremst++;
        expect(res.headers.get('retry-after')).toBeTruthy();
      }
    }
    expect(gebremst).toBeGreaterThan(0);

    // Anderes Konto ist davon nicht betroffen
    const gast = cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name: 'Gast', email: testmail('Gast'), passwort: 'geheim123' } }));
    expect((await speichern(stand, gast)).status).toBe(204);
  });

  it('lässt das normale Spieltempo (alle 3 Sekunden) unbegrenzt durch', async () => {
    const stand = createNeuesSpiel();
    // Im Zeitfenster von 10 s speichert das Spiel höchstens 4-mal
    for (let i = 0; i < 4; i++) expect((await speichern(stand, spieler)).status).toBe(204);
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

  const buchung = (id: string, label: string, amount: number, kind: 'Einnahme' | 'Ausgabe' = 'Einnahme') =>
    ({ id, kind, label, amount, createdAt: new Date().toISOString() });
  const gespeichert = async () => (await (await laden(spieler)).json()).spielstand;

  it('erkennt erfundene Schichtzulagen und Team-Korrekturen, lässt echte durch', async () => {
    const start = createNeuesSpiel();
    await speichern(start, spieler);
    // Erfunden: 50 Mio. € als „Schichtzulage“, ohne dass der Server sie vergeben hat
    await speichern({ ...start, balance: start.balance + 50_000_000, transactions: [buchung('f1', 'Schichtzulage – Tag 1 in Folge', 50_000_000), ...start.transactions] }, spieler);
    expect((await gespeichert()).balance).toBe(start.balance);

    // Echt: Der Server vergibt die Schichtzulage (1.000 €), das Spiel bucht sie ein
    await server.anfrage('POST', '/spielstand/schichtzulage', { cookie: spieler });
    const mitZulage = { ...start, balance: start.balance + 1000, transactions: [buchung('z1', 'Schichtzulage – Tag 1 in Folge', 1000), ...start.transactions] };
    await speichern(mitZulage, spieler);
    expect((await gespeichert()).balance).toBe(start.balance + 1000);
    // Dieselbe Zulage ein zweites Mal (neue Buchungs-ID) zählt nicht
    await speichern({ ...mitZulage, balance: mitZulage.balance + 1000, transactions: [buchung('z2', 'Schichtzulage – Tag 1 in Folge', 1000), ...mitZulage.transactions] }, spieler);
    expect((await gespeichert()).balance).toBe(start.balance + 1000);
  });

  it('lässt eine echte Team-Korrektur durch', async () => {
    const start = createNeuesSpiel();
    await speichern(start, spieler);
    const ich = server.db.prepare("SELECT id FROM benutzer WHERE name = 'Disponent'").get() as { id: number };
    server.db.prepare("INSERT INTO spielstand_korrekturen (benutzer_id, guthaben_aenderung, grund, von_name) VALUES (?, 25000, 'Fehler im Spiel', 'Owner')").run(ich.id);
    await speichern({ ...start, balance: start.balance + 25_000, transactions: [buchung('t1', 'Korrektur durch das Team – Fehler im Spiel', 25_000), ...start.transactions] }, spieler);
    expect((await gespeichert()).balance).toBe(start.balance + 25_000);
    expect(protokoll()).toEqual([]);
  });

  it('lässt Dev-Werkzeug-Gutschriften bei Testern durch', async () => {
    server.db.prepare("UPDATE benutzer SET rolle = 'tester' WHERE name = 'Disponent'").run();
    const start = createNeuesSpiel();
    await speichern(start, spieler);
    await speichern({ ...start, balance: start.balance + 1_000_000, transactions: [buchung('d1', 'Dev-Werkzeug: Guthaben angepasst', 1_000_000), ...start.transactions] }, spieler);
    expect((await gespeichert()).balance).toBe(start.balance + 1_000_000);
  });

  it('erkennt erfundene Dev-Werkzeug-Gutschriften bei Spielern', async () => {
    const start = createNeuesSpiel();
    await speichern(start, spieler);
    await speichern({ ...start, balance: start.balance + 1_000_000, transactions: [buchung('d1', 'Dev-Werkzeug: Guthaben angepasst', 1_000_000), ...start.transactions] }, spieler);
    expect((await gespeichert()).balance).toBe(start.balance);
  });

  it('lässt einen echten Kredit durch, aber keine erfundenen Kreditauszahlungen', async () => {
    const start = createNeuesSpiel();
    await speichern(start, spieler);
    const kredit = { id: 'kredit-1', betrag: 10_000, zinsSatz: 0.05, laufzeitStunden: 4, gesamtSchuld: 10_500, restSchuld: 10_500, rateJeStunde: 2625, aufgenommenAt: Date.now() };
    const mitKredit = { ...start, kredit, balance: start.balance + 10_000, transactions: [buchung('kr1', 'Kredit ausgezahlt', 10_000), ...start.transactions] };
    await speichern(mitKredit, spieler);
    expect((await gespeichert()).balance).toBe(start.balance + 10_000);
    // Weitere „Auszahlungen“ ohne neuen Kredit
    await speichern({ ...mitKredit, balance: mitKredit.balance + 400_000, transactions: [buchung('kr2', 'Kredit ausgezahlt', 400_000), ...mitKredit.transactions] }, spieler);
    expect((await gespeichert()).balance).toBe(start.balance + 10_000);
  });

  it('prüft auch ein neues Spiel: keine Millionen ohne Buchungen, kein erfundenes Startguthaben', async () => {
    await speichern(createNeuesSpiel(new Date(Date.now() - 60_000)), spieler);
    const neu = createNeuesSpiel();
    await speichern({ ...neu, balance: 777_777_777 }, spieler);
    expect((await gespeichert()).balance).toBe(neu.balance);
    const neu2 = createNeuesSpiel(new Date(Date.now() + 1000));
    await speichern({ ...neu2, balance: 5_000_000, transactions: [{ ...neu2.transactions[0], amount: 5_000_000 }] }, spieler);
    expect((await gespeichert()).balance).toBe(neu2.balance);
  });

  it('prüft schon den ersten Spielstand eines Kontos', async () => {
    await speichern({ ...createNeuesSpiel(), balance: 9_000_000 }, spieler);
    expect((await gespeichert()).balance).toBe(createNeuesSpiel().balance);
  });

  describe('Bestenliste: Laufbahn und Ruf', () => {
    const laufbahn = (xp: number, einsaetze: number, perfekt = 0) => ({ xp, einsaetze, perfekt, erfolge: [] });
    const vorStunden = (stunden: number) => server.db.prepare('UPDATE spielstaende SET aktualisiert = ?')
      .run(new Date(Date.now() - stunden * 3_600_000).toISOString());

    it('kappt unmöglich schnellen Zuwachs an EP und Einsätzen und vermerkt es', async () => {
      const start = createNeuesSpiel();
      await speichern(start, spieler);
      await speichern({ ...start, laufbahn: laufbahn(999_999_999, 50_000, 50_000) }, spieler);
      const lb = (await gespeichert()).laufbahn;
      expect(lb.einsaetze).toBeLessThanOrEqual(101);
      expect(lb.perfekt).toBeLessThanOrEqual(lb.einsaetze);
      expect(lb.xp).toBeLessThan(50_000);
      expect(protokoll()).toContainEqual({ aktion: 'Laufbahn korrigiert', ziel: 'Disponent' });
    });

    it('lässt ehrliches Spiel über Stunden unangetastet', async () => {
      const start = { ...createNeuesSpiel(), laufbahn: laufbahn(500, 10, 2) };
      await speichern(start, spieler);
      vorStunden(2);
      // 2 Stunden mit 600 Einsätzen à 60 EP – mehr schafft man kaum
      await speichern({ ...start, laufbahn: laufbahn(500 + 36_000, 610, 300) }, spieler);
      expect((await gespeichert()).laufbahn).toEqual(laufbahn(36_500, 610, 300));
      expect(protokoll()).toEqual([]);
    });

    it('ersetzt eine kaputte Laufbahn (EP als Text) durch den bisherigen Stand', async () => {
      const start = { ...createNeuesSpiel(), laufbahn: laufbahn(500, 10) };
      await speichern(start, spieler);
      await speichern({ ...start, laufbahn: { xp: '999999999', einsaetze: 10, perfekt: 0, erfolge: [] } }, spieler);
      expect((await gespeichert()).laufbahn).toEqual(laufbahn(500, 10));
      const zeile = server.db.prepare('SELECT xp FROM bestenliste').get() as { xp: number };
      expect(zeile.xp).toBe(500);
    });

    it('deckelt Fuhrpark und Wachen in der Bestenliste, ohne Fahrzeuge zu löschen', async () => {
      const start = createNeuesSpiel();
      await speichern(start, spieler);
      // Manipulierter Stand: 5.000 Fahrzeuge und 900 Wachen
      const fahrzeuge = Array.from({ length: 5000 }, (_, i) => ({ id: `v${i}`, name: 'RTW', type: 'RTW', stationId: start.locations[0]?.id, price: 0 }));
      const wachen = Array.from({ length: 900 }, (_, i) => ({ ...start.locations[0], id: `w${i}`, type: 'station' as const }));
      await speichern({ ...start, vehicles: fahrzeuge, locations: wachen }, spieler);

      const gespeicherterStand = await gespeichert();
      // Der Spielstand selbst bleibt vollständig – niemand verliert Fahrzeuge
      expect(gespeicherterStand.vehicles).toHaveLength(5000);
      // ... aber die Bestenliste bekommt gedeckelte Werte
      const zeile = server.db.prepare('SELECT wachen, fahrzeuge FROM bestenliste').get() as { wachen: number; fahrzeuge: number };
      expect(zeile.fahrzeuge).toBeLessThanOrEqual(PLAUSIBILITAET.fahrzeugeSockel + PLAUSIBILITAET.fahrzeugeProStundeMax);
      expect(zeile.wachen).toBeLessThanOrEqual(PLAUSIBILITAET.wachenSockel + PLAUSIBILITAET.wachenProStundeMax);
      expect(protokoll()).toContainEqual({ aktion: 'Fuhrpark korrigiert', ziel: 'Disponent' });
    });

    it('lässt einen normal gewachsenen Fuhrpark unangetastet', async () => {
      const start = createNeuesSpiel();
      await speichern(start, spieler);
      const fahrzeuge = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, name: 'RTW', type: 'RTW', stationId: start.locations[0]?.id, price: 0 }));
      await speichern({ ...start, vehicles: fahrzeuge }, spieler);
      const zeile = server.db.prepare('SELECT fahrzeuge FROM bestenliste').get() as { fahrzeuge: number };
      expect(zeile.fahrzeuge).toBe(12);
      expect(protokoll()).toEqual([]);
    });

    it('begrenzt den Ruf auf den erlaubten Bereich', async () => {
      await speichern({ ...createNeuesSpiel(), ruf: 1e9 }, spieler);
      expect((await gespeichert()).ruf).toBe(100);
      await speichern({ ...createNeuesSpiel(), ruf: 'viel' }, spieler);
      expect((await gespeichert()).ruf).toBe(50);
    });
  });
});
