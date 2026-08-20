import cors from 'cors';
import express from 'express';
import { getAppInfo } from '@leitstellendispo/shared';

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

app.listen(PORT, () => {
  console.log(`LeitstellenDispo Server läuft auf http://localhost:${PORT}`);
});
