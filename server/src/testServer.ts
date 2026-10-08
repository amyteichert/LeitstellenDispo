// Hilfen für Server-Tests: App mit In-Memory-Datenbank auf zufälligem Port
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { erstelleApp } from './app.js';
import { oeffneDatenbank, type Datenbank } from './datenbank.js';
import type { AuthOptionen } from './auth.js';

export interface TestServer {
  db: Datenbank;
  anfrage(methode: string, pfad: string, optionen?: { body?: unknown; cookie?: string }): Promise<Response>;
  beenden(): Promise<void>;
}

export async function starteTestServer(optionen: AuthOptionen = {}): Promise<TestServer> {
  const db = oeffneDatenbank(':memory:');
  const server: Server = erstelleApp(db, { bcryptRunden: 4, ...optionen }).listen(0);
  await new Promise<void>((fertig) => server.once('listening', fertig));
  const basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  return {
    db,
    anfrage(methode, pfad, { body, cookie } = {}) {
      return fetch(basis + pfad, {
        method: methode,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
    },
    async beenden() {
      await new Promise((fertig) => server.close(fertig));
      db.close();
    },
  };
}

/** Nur „name=wert“ aus dem Set-Cookie-Header – so, wie ein Browser es zurückschicken würde */
export function cookieAus(res: Response): string {
  return (res.headers.get('set-cookie') ?? '').split(';')[0];
}

/** Eindeutige Test-E-Mail zu einem Benutzernamen */
export const testmail = (name: string) => `${name.toLowerCase()}@test.de`;
