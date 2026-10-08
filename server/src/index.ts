import { erstelleApp } from './app.js';
import { STANDARD_DATENBANK_PFAD, oeffneDatenbank } from './datenbank.js';
import { mailversandAusUmgebung } from './mail.js';

const PORT = process.env.PORT ?? 3001;
const datenbankPfad = process.env.DATENBANK_PFAD ?? STANDARD_DATENBANK_PFAD;

const db = oeffneDatenbank(datenbankPfad);
// SPIEL_URL: Basisadresse für Links in Mails, z. B. https://spiel.leitstellendispo.de
const app = erstelleApp(db, { mailversand: mailversandAusUmgebung(), spielUrl: process.env.SPIEL_URL || undefined });

app.listen(PORT, () => {
  console.log(`LeitstellenDispo Server läuft auf http://localhost:${PORT}`);
  console.log(`Mailversand: ${process.env.MAIL_VERSAND || 'aus'}`);
});
