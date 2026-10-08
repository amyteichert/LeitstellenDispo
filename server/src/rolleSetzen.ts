// Kommandozeile: Rolle eines Kontos setzen – vor allem, um das eigene Konto zum Owner zu machen.
//
//   Auf dem Server (im Ordner der aktiven Version):
//     DATENBANK_PFAD=/var/lib/leitstellendispo/<datei>.db node server/dist/rolleSetzen.js Amy.Projektleitung owner
//
// Wird jemand Owner, werden alle anderen Owner-Konten (z. B. ein Testkonto, das sich zuerst registriert hat) zu Spielern.
import { fileURLToPath } from 'node:url';
import type { UserRole } from '@leitstellendispo/shared';
import { STANDARD_DATENBANK_PFAD, oeffneDatenbank, type Datenbank } from './datenbank.js';

const ROLLEN: UserRole[] = ['owner', 'co_owner', 'admin', 'player'];

export function setzeRolle(db: Datenbank, name: string, rolle: UserRole): { name: string; rolle: UserRole; herabgestuft: string[] } {
  if (!ROLLEN.includes(rolle)) throw new Error(`Unbekannte Rolle „${rolle}“. Erlaubt: ${ROLLEN.join(', ')}`);
  return db.transaction(() => {
    const konto = db.prepare('SELECT id, name FROM benutzer WHERE name = ?').get(name) as { id: number; name: string } | undefined;
    if (!konto) throw new Error(`Kein Konto mit dem Namen „${name}“ gefunden.`);
    let herabgestuft: string[] = [];
    if (rolle === 'owner') {
      herabgestuft = (db.prepare("SELECT name FROM benutzer WHERE rolle = 'owner' AND id != ?").all(konto.id) as Array<{ name: string }>).map((z) => z.name);
      db.prepare("UPDATE benutzer SET rolle = 'player' WHERE rolle = 'owner' AND id != ?").run(konto.id);
    }
    db.prepare('UPDATE benutzer SET rolle = ? WHERE id = ?').run(rolle, konto.id);
    return { name: konto.name, rolle, herabgestuft };
  })();
}

// Nur ausführen, wenn direkt aufgerufen (nicht beim Import in Tests)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [name, rolle] = process.argv.slice(2);
  if (!name || !rolle) {
    console.error('Aufruf: node server/dist/rolleSetzen.js <Benutzername> <owner|co_owner|admin|player>');
    process.exit(1);
  }
  const db = oeffneDatenbank(process.env.DATENBANK_PFAD ?? STANDARD_DATENBANK_PFAD);
  try {
    const ergebnis = setzeRolle(db, name, rolle as UserRole);
    console.log(`✓ ${ergebnis.name} ist jetzt ${ergebnis.rolle}.`);
    if (ergebnis.herabgestuft.length > 0) console.log(`  Zu Spielern herabgestuft: ${ergebnis.herabgestuft.join(', ')}`);
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
