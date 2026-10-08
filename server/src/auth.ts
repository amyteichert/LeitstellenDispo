// Endpunkte für Registrieren, Anmelden, Abmelden und „Wer bin ich“ sowie Middleware für geschützte Routen
import { Router, type CookieOptions, type NextFunction, type Request, type Response } from 'express';
import { pruefeBenutzername, pruefePasswort, type Konto } from '@leitstellendispo/shared';
import { erstelleFehlversuchBremse } from './fehlversuchBremse.js';
import { SITZUNG_DAUER_MS, type KontenDienst } from './konten.js';

export const SITZUNG_COOKIE = 'ld_sitzung';

function cookieOptionen(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

function sitzungsToken(req: Request): string | undefined {
  const token: unknown = req.cookies?.[SITZUNG_COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

function setzeSitzungsCookie(res: Response, token: string) {
  res.cookie(SITZUNG_COOKIE, token, { ...cookieOptionen(), maxAge: SITZUNG_DAUER_MS });
}

/** Hängt das angemeldete Konto (oder `null`) an `res.locals.konto`. */
export function ladeKonto(konten: KontenDienst) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = sitzungsToken(req);
    res.locals.konto = token ? konten.kontoZurSitzung(token) : null;
    next();
  };
}

/** Lässt nur angemeldete Konten durch (nach `ladeKonto` verwenden). */
export function nurAngemeldet(_req: Request, res: Response, next: NextFunction) {
  if (!res.locals.konto) {
    res.status(401).json({ fehler: 'Bitte zuerst anmelden.' });
    return;
  }
  next();
}

export function erstelleAuthRouter(konten: KontenDienst): Router {
  const router = Router();
  const anmeldeBremse = erstelleFehlversuchBremse({ maxVersuche: 10, fensterMs: 15 * 60 * 1000 });
  const registrierBremse = erstelleFehlversuchBremse({ maxVersuche: 5, fensterMs: 60 * 60 * 1000 });

  function zuVieleVersuche(res: Response, sekunden: number) {
    res.setHeader('Retry-After', String(sekunden));
    res.status(429).json({ fehler: `Zu viele Versuche. Bitte in ${Math.ceil(sekunden / 60)} Minute(n) erneut versuchen.` });
  }

  router.post('/registrieren', async (req, res, next) => {
    try {
      const ip = req.ip ?? 'unbekannt';
      const warten = registrierBremse.gesperrtFuer(ip);
      if (warten > 0) return zuVieleVersuche(res, warten);

      const { name, passwort } = req.body ?? {};
      const fehler = pruefeBenutzername(name) ?? pruefePasswort(passwort);
      if (fehler) return void res.status(400).json({ fehler });

      registrierBremse.merkeFehlversuch(ip); // zählt jede Registrierung, nicht nur fehlgeschlagene
      const konto = await konten.registriere((name as string).trim(), passwort as string);
      if (!konto) return void res.status(409).json({ fehler: 'Dieser Benutzername ist schon vergeben.' });

      setzeSitzungsCookie(res, konten.starteSitzung(konto.id));
      res.status(201).json({ konto });
    } catch (e) {
      next(e);
    }
  });

  router.post('/anmelden', async (req, res, next) => {
    try {
      const ip = req.ip ?? 'unbekannt';
      const warten = anmeldeBremse.gesperrtFuer(ip);
      if (warten > 0) return zuVieleVersuche(res, warten);

      const { name, passwort } = req.body ?? {};
      if (typeof name !== 'string' || typeof passwort !== 'string') {
        return void res.status(400).json({ fehler: 'Bitte Benutzername und Passwort angeben.' });
      }

      const ergebnis = await konten.pruefeAnmeldung(name.trim(), passwort);
      if (!ergebnis.ok) {
        if (ergebnis.grund === 'gesperrt') {
          return void res.status(403).json({ fehler: 'Dieses Konto ist gesperrt.' });
        }
        anmeldeBremse.merkeFehlversuch(ip);
        return void res.status(401).json({ fehler: 'Benutzername oder Passwort ist falsch.' });
      }

      anmeldeBremse.zuruecksetzen(ip);
      const altesToken = sitzungsToken(req);
      if (altesToken) konten.beendeSitzung(altesToken);
      setzeSitzungsCookie(res, konten.starteSitzung(ergebnis.konto.id));
      res.json({ konto: ergebnis.konto });
    } catch (e) {
      next(e);
    }
  });

  router.post('/abmelden', (req, res) => {
    const token = sitzungsToken(req);
    if (token) konten.beendeSitzung(token);
    res.clearCookie(SITZUNG_COOKIE, cookieOptionen());
    res.status(204).end();
  });

  router.get('/ich', ladeKonto(konten), (_req, res) => {
    const konto = res.locals.konto as Konto | null;
    if (!konto) return void res.status(401).json({ fehler: 'Nicht angemeldet.' });
    res.json({ konto });
  });

  return router;
}
