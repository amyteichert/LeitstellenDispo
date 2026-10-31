import { erstelleApp } from './app.js';
import { dirname, join } from 'node:path';
import { STANDARD_DATENBANK_PFAD, oeffneDatenbank } from './datenbank.js';
import { starteAutomatischeSicherung } from './sicherung.js';
import { mailversandAusUmgebung } from './mail.js';

const PORT = process.env.PORT ?? 3001;
const datenbankPfad = process.env.DATENBANK_PFAD ?? STANDARD_DATENBANK_PFAD;

const db = oeffneDatenbank(datenbankPfad);
// Sicherungen neben der Datenbank (server/data/sicherungen), alle 6 Stunden, die letzten 14 bleiben
const sicherungsOrdner = process.env.SICHERUNGS_ORDNER ?? join(dirname(datenbankPfad), 'sicherungen');
starteAutomatischeSicherung(db, sicherungsOrdner);
// SPIEL_URL: Basisadresse für Links in Mails, z. B. https://spiel.leitstellendispo.de
// KONTEN_FREISCHALTEN=1: neue Konten brauchen eine Freischaltung durchs Team (Testumgebung)
// OSRM_URL: eigener Routing-Server für Fahrten auf echten Straßen, z. B. http://127.0.0.1:5000 (ohne: Luftlinie)
const app = erstelleApp(db, { mailversand: mailversandAusUmgebung(), freischaltungNoetig: process.env.KONTEN_FREISCHALTEN === '1', spielUrl: process.env.SPIEL_URL || undefined, sicherungsOrdner, osrmUrl: process.env.OSRM_URL || undefined,
  // EINSAETZE_AUFRAEUMEN_BIS: z. B. 2026-10-26T01:00:00+01:00 – alle Einsätze, die vorher entstanden sind, verschwinden bei allen Spielern
  einsaetzeAufraeumenBis: Date.parse(process.env.EINSAETZE_AUFRAEUMEN_BIS ?? '') || undefined,
});

// HOST=127.0.0.1 auf dem Server: nur nginx auf demselben Rechner erreicht die API, nicht das Internet
const HOST = process.env.HOST || '0.0.0.0';

app.listen(Number(PORT), HOST, () => {
  console.log(`LeitstellenDispo Server läuft auf http://${HOST}:${PORT}`);
  console.log(`Mailversand: ${process.env.MAIL_VERSAND || 'aus'}`);
  if (process.env.EINSAETZE_AUFRAEUMEN_BIS) console.log(`Einsätze aufräumen bis: ${process.env.EINSAETZE_AUFRAEUMEN_BIS}`);
  if (process.env.KONTEN_FREISCHALTEN === '1') console.log('Neue Konten brauchen eine Freischaltung durchs Team');
  console.log(`Straßen-Routing: ${process.env.OSRM_URL || 'aus (Luftlinie)'}`);
});
