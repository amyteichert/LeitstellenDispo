import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { oeffneDatenbank } from './datenbank.js';
import { legeSicherungAn, listeSicherungen } from './sicherung.js';
import { cookieAus, starteTestServer, testmail } from './testServer.js';

const ordner: string[] = [];
const neuerOrdner = () => {
  const pfad = mkdtempSync(join(tmpdir(), 'ld-sicherung-'));
  ordner.push(pfad);
  return pfad;
};
afterEach(() => ordner.splice(0).forEach((pfad) => rmSync(pfad, { recursive: true, force: true })));

describe('Datenbank-Sicherung', () => {
  it('legt eine lesbare Kopie an und behält nur die neuesten', async () => {
    const db = oeffneDatenbank(':memory:');
    db.prepare("INSERT INTO benutzer (name, passwort_hash) VALUES ('Disponent', 'x')").run();
    const ziel = neuerOrdner();

    for (let i = 0; i < 4; i++) await legeSicherungAn(db, ziel, 3, new Date(Date.UTC(2026, 9, 17, 10, i)));

    const dateien = listeSicherungen(ziel);
    expect(dateien).toEqual([
      'leitstellendispo-2026-10-17_10-03-00.db',
      'leitstellendispo-2026-10-17_10-02-00.db',
      'leitstellendispo-2026-10-17_10-01-00.db',
    ]);
    const kopie = new Database(join(ziel, dateien[0]), { readonly: true });
    expect(kopie.prepare('SELECT name FROM benutzer').get()).toEqual({ name: 'Disponent' });
    kopie.close();
    db.close();
  });

  it('gibt es zum Herunterladen nur für den Owner', async () => {
    const server = await starteTestServer({ sicherungsOrdner: neuerOrdner() });
    const registriere = async (name: string) =>
      cookieAus(await server.anfrage('POST', '/auth/registrieren', { body: { name, email: testmail(name), passwort: 'geheim123' } }));
    const owner = await registriere('Chefin');
    const spieler = await registriere('Disponent');
    server.db.prepare("UPDATE benutzer SET rolle = 'owner' WHERE name = 'Chefin'").run();

    const verboten = await server.anfrage('GET', '/team/sicherung', { cookie: spieler });
    expect(verboten.status).toBe(403);
    await verboten.text();

    const res = await server.anfrage('GET', '/team/sicherung', { cookie: owner });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/leitstellendispo-.*\.db/);
    // SQLite-Dateien beginnen mit „SQLite format 3“
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 15).toString()).toBe('SQLite format 3');
    await server.beenden();
  });
});
