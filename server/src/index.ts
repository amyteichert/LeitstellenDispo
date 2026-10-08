import { erstelleApp } from './app.js';
import { STANDARD_DATENBANK_PFAD, oeffneDatenbank } from './datenbank.js';

const PORT = process.env.PORT ?? 3001;
const datenbankPfad = process.env.DATENBANK_PFAD ?? STANDARD_DATENBANK_PFAD;

const db = oeffneDatenbank(datenbankPfad);
const app = erstelleApp(db);

app.listen(PORT, () => {
  console.log(`LeitstellenDispo Server läuft auf http://localhost:${PORT}`);
});
