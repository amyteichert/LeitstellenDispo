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
const app = erstelleApp(db, { mailversand: mailversandAusUmgebung(), spielUrl: process.env.SPIEL_URL || undefined, sicherungsOrdner });

app.listen(PORT, () => {
  console.log(`LeitstellenDispo Server läuft auf http://localhost:${PORT}`);
  console.log(`Mailversand: ${process.env.MAIL_VERSAND || 'aus'}`);
});
