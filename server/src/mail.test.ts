import { createServer, type Server } from 'node:net';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { KEIN_MAILVERSAND, KONSOLEN_MAILVERSAND, mailversandAusUmgebung, smtpMailversand } from './mail.js';

/**
 * Winziger SMTP-Empfänger für den Test: spricht gerade so viel SMTP, dass nodemailer eine Mail zustellt.
 * Damit ist geprüft, dass der Mailversand wirklich funktioniert (und nicht nur die Typen stimmen).
 */
function starteTestSmtp(): Promise<{ port: number; empfangen: Promise<string>; schliessen(): void }> {
  let fertig!: (text: string) => void;
  const empfangen = new Promise<string>((f) => { fertig = f; });
  const server: Server = createServer((socket) => {
    let daten = '';
    let imDatenteil = false;
    socket.write('220 test.local ESMTP\r\n');
    socket.on('data', (teil) => {
      const text = teil.toString();
      if (imDatenteil) {
        daten += text;
        if (daten.includes('\r\n.\r\n')) {
          imDatenteil = false;
          socket.write('250 OK\r\n');
          fertig(daten);
        }
        return;
      }
      for (const zeile of text.split('\r\n').filter(Boolean)) {
        const befehl = zeile.toUpperCase();
        if (befehl.startsWith('EHLO') || befehl.startsWith('HELO')) socket.write('250-test.local\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (befehl.startsWith('AUTH')) socket.write('235 OK\r\n');
        else if (befehl.startsWith('MAIL FROM') || befehl.startsWith('RCPT TO')) socket.write('250 OK\r\n');
        else if (befehl.startsWith('DATA')) { imDatenteil = true; socket.write('354 Ende mit .\r\n'); }
        else if (befehl.startsWith('QUIT')) { socket.write('221 Tschüss\r\n'); socket.end(); }
        else socket.write('250 OK\r\n');
      }
    });
    socket.on('error', () => {});
  });
  return new Promise((aufgeloest) => {
    server.listen(0, '127.0.0.1', () => {
      aufgeloest({ port: (server.address() as AddressInfo).port, empfangen, schliessen: () => server.close() });
    });
  });
}

let smtp: Awaited<ReturnType<typeof starteTestSmtp>> | null = null;
afterEach(() => smtp?.schliessen());

describe('Mailversand', () => {
  it('stellt eine Mail über SMTP zu (Betreff, Empfänger und Text kommen an)', async () => {
    smtp = await starteTestSmtp();
    const versand = smtpMailversand({
      host: '127.0.0.1', port: smtp.port, benutzer: 'test', passwort: 'geheim', absender: 'LeitstellenDispo <noreply@test.local>',
    });
    await versand.sende({ an: 'spieler@test.local', betreff: 'Passwort zurücksetzen', text: 'Hallo Disponent,\nhier ist dein Link.' });

    const roh = await smtp.empfangen;
    expect(roh).toContain('To: spieler@test.local');
    expect(roh).toContain('noreply@test.local');
    // Betreff und Text dürfen MIME-kodiert sein – Umlautfreie Teile müssen lesbar bleiben
    expect(roh.replace(/=\r\n/g, '')).toContain('Passwort');
    expect(roh.replace(/=\r\n/g, '')).toContain('hier ist dein Link.');
  });

  it('meldet einen nicht erreichbaren Server als Fehler, statt still zu scheitern', async () => {
    const versand = smtpMailversand({ host: '127.0.0.1', port: 1, benutzer: 'a', passwort: 'b', absender: 'a@test.local' });
    await expect(versand.sende({ an: 'x@test.local', betreff: 'x', text: 'x' })).rejects.toThrow();
  });

  it('wählt den Versandweg nach der Umgebung', () => {
    expect(mailversandAusUmgebung({}).aktiv).toBe(false);
    expect(mailversandAusUmgebung({ MAIL_VERSAND: 'konsole' })).toBe(KONSOLEN_MAILVERSAND);
    // smtp ohne Zugangsdaten: lieber gar kein Versand als ein Absturz beim Start
    expect(mailversandAusUmgebung({ MAIL_VERSAND: 'smtp' })).toBe(KEIN_MAILVERSAND);
    expect(mailversandAusUmgebung({ MAIL_VERSAND: 'smtp', SMTP_HOST: 'h', SMTP_BENUTZER: 'b', SMTP_PASSWORT: 'p' }).aktiv).toBe(true);
  });
});
