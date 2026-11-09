// Bestenliste: Spieler im Vergleich (nur für angemeldete Spieler)
import { Router } from 'express';
import {
  BESTENLISTE_CONFIG,
  istBestenlisteKategorie,
  ordneBestenliste,
  type BestenlisteAntwort,
  type BestenlisteEintrag,
  type Konto,
} from '@leitstellendispo/shared';
import type { Datenbank } from './datenbank.js';
import { ladeKonto, nurAngemeldet } from './auth.js';
import type { KontenDienst } from './konten.js';

interface Zeile {
  id: number;
  name: string;
  spitzname: string | null;
  avatar: string | null;
  erstellt: string;
  xp: number;
  einsaetze: number;
  perfekt: number;
  ruf: number;
  wachen: number;
  fahrzeuge: number;
}

export function erstelleBestenlisteRouter(db: Datenbank, konten: KontenDienst): Router {
  const router = Router();
  // Gesperrte, nicht freigeschaltete und mit Dev-Werkzeugen gespielte Konten zählen nicht
  const alle = db.prepare(`
    SELECT b.id, b.name, b.spitzname, b.avatar, b.erstellt,
           l.xp, l.einsaetze, l.perfekt, l.ruf, l.wachen, l.fahrzeuge
    FROM bestenliste l JOIN benutzer b ON b.id = l.benutzer_id
    WHERE b.gesperrt = 0 AND b.dev_markiert = 0 AND b.freigegeben = 1`);

  // Die Tabelle enthält nur Kurzfassungen – sie bei jedem Aufruf zu lesen ist günstig
  const ladeSpieler = (): Array<Pick<BestenlisteEintrag, 'konto' | 'werte'>> =>
    (alle.all() as Zeile[]).map((z) => ({
      konto: { id: z.id, name: z.name, spitzname: z.spitzname, avatar: z.avatar, erstellt: z.erstellt },
      werte: { xp: z.xp, einsaetze: z.einsaetze, perfekt: z.perfekt, ruf: z.ruf, wachen: z.wachen, fahrzeuge: z.fahrzeuge },
    }));

  router.use(ladeKonto(konten), nurAngemeldet);

  router.get('/', (req, res) => {
    const kategorie = istBestenlisteKategorie(req.query.kategorie) ? req.query.kategorie : 'xp';
    const geordnet = ordneBestenliste(ladeSpieler(), kategorie);
    const eigeneId = (res.locals.konto as Konto).id;
    const antwort: BestenlisteAntwort = {
      kategorie,
      eintraege: geordnet.slice(0, BESTENLISTE_CONFIG.plaetze),
      eigener: geordnet.find((eintrag) => eintrag.konto.id === eigeneId) ?? null,
      teilnehmer: geordnet.length,
    };
    res.json(antwort);
  });

  return router;
}
