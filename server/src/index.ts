import cors from 'cors';
import express from 'express';
import { getAppInfo } from '@leitstellendispo/shared';
import type { Einsatz } from '@leitstellendispo/shared';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/info', (_req, res) => {
  res.json(getAppInfo());
});

// Feste Beispieldaten für den ersten Durchstich – wird später durch echte Einsatzlogik ersetzt.
const beispielEinsaetze: Einsatz[] = [
  { id: 'E-001', stichwort: 'RD 1', meldebild: 'Internistischer Notfall', status: 'offen' },
  { id: 'E-002', stichwort: 'B 2', meldebild: 'Zimmerbrand', status: 'alarmiert' },
  { id: 'E-003', stichwort: 'TH 1', meldebild: 'Ölspur', status: 'in_bearbeitung' },
];

app.get('/api/einsaetze', (_req, res) => {
  res.json(beispielEinsaetze);
});

app.listen(PORT, () => {
  console.log(`LeitstellenDispo Server läuft auf http://localhost:${PORT}`);
});
