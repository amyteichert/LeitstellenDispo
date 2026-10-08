// Endpunkte für Registrieren, Anmelden, Abmelden und „Wer bin ich“ sowie Middleware für geschützte Routen
import { Router, type CookieOptions, type NextFunction, type Request, type Response } from 'express';
import { pruefeBenutzername, pruefeEmail, pruefePasswort, type Konto } from '@leitstellendispo/shared';
import { erstelleFehlversuchBremse } from './fehlversuchBremse.js';
import { SITZUNG_DAUER_MS, type KontenDienst } from './konten.js';
import { KEIN_MAILVERSAND, type Mailversand } from './mail.js';

export interface AuthOptionen {
  mailversand?: Mailversand;
  /** Basisadresse des Spiels für Links in Mails (Standard: Adresse der Anfrage) */
  spielUrl?: string;
}

/** Link zum Zurücksetzen des Passworts */
export function passwortLink(basis: string, token: string): string {
  return `${basis.replace(/\/+$/, '')}/passwort-zuruecksetzen?token=${encodeURIComponent(token)}`;
}

export const spielBasisUrl = (req: Request, spielUrl?: string) => spielUrl ?? `${req.protocol}://${req.get('host')}`;

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

export function erstelleAuthRouter(konten: KontenDienst, optionen: AuthOptionen = {}): Router {
  const router = Router();
  const mailversand = optionen.mailversand ?? KEIN_MAILVERSAND;
  const vergessenBremse = erstelleFehlversuchBremse({ maxVersuche: 5, fensterMs: 60 * 60 * 1000 });
  const zuruecksetzenBremse = erstelleFehlversuchBremse({ maxVersuche: 10, fensterMs: 60 * 60 * 1000 });
  const kontoAenderungBremse = erstelleFehlversuchBremse({ maxVersuche: 10, fensterMs: 15 * 60 * 1000 });
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

      const { name, email, passwort } = req.body ?? {};
      const fehler = pruefeEmail(email) ?? pruefeBenutzername(name) ?? pruefePasswort(passwort);
      if (fehler) return void res.status(400).json({ fehler });

      registrierBremse.merkeFehlversuch(ip); // zählt jede Registrierung, nicht nur fehlgeschlagene
      const ergebnis = await konten.registriere((name as string).trim(), email as string, passwort as string);
      if (!ergebnis.ok) {
        return void res.status(409).json({
          fehler: ergebnis.grund === 'name_vergeben'
            ? 'Dieser Benutzername ist schon vergeben.'
            : 'Zu dieser E-Mail-Adresse gibt es schon ein Konto. Melde dich damit an oder setze das Passwort zurück.',
        });
      }

      setzeSitzungsCookie(res, konten.starteSitzung(ergebnis.konto.id));
      res.status(201).json({ konto: ergebnis.konto });
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

  /** Welche Funktionen der Server gerade anbietet (z. B. ob „Passwort vergessen“ per Mail geht) */
  router.get('/funktionen', (_req, res) => {
    res.json({ passwortVergessen: mailversand.aktiv });
  });

  // ---- Eigenes Konto ändern (angemeldet, immer mit aktuellem Passwort) ----

  router.post('/email', ladeKonto(konten), nurAngemeldet, async (req, res, next) => {
    try {
      const ip = req.ip ?? 'unbekannt';
      const warten = kontoAenderungBremse.gesperrtFuer(ip);
      if (warten > 0) return zuVieleVersuche(res, warten);
      const { email, passwort } = req.body ?? {};
      const fehler = pruefeEmail(email);
      if (fehler) return void res.status(400).json({ fehler });
      if (typeof passwort !== 'string') return void res.status(400).json({ fehler: 'Bitte dein aktuelles Passwort angeben.' });

      const ergebnis = await konten.aendereEmail((res.locals.konto as Konto).id, email as string, passwort);
      if (ergebnis === 'falsches_passwort') {
        kontoAenderungBremse.merkeFehlversuch(ip);
        return void res.status(403).json({ fehler: 'Das Passwort ist falsch.' });
      }
      if (ergebnis === 'email_vergeben') return void res.status(409).json({ fehler: 'Diese E-Mail-Adresse gehört schon zu einem anderen Konto.' });
      res.json({ konto: konten.kontoZurSitzung(sitzungsToken(req)!) });
    } catch (e) {
      next(e);
    }
  });

  router.post('/passwort', ladeKonto(konten), nurAngemeldet, async (req, res, next) => {
    try {
      const ip = req.ip ?? 'unbekannt';
      const warten = kontoAenderungBremse.gesperrtFuer(ip);
      if (warten > 0) return zuVieleVersuche(res, warten);
      const { altesPasswort, neuesPasswort } = req.body ?? {};
      const fehler = pruefePasswort(neuesPasswort);
      if (fehler) return void res.status(400).json({ fehler });
      if (typeof altesPasswort !== 'string') return void res.status(400).json({ fehler: 'Bitte dein aktuelles Passwort angeben.' });

      const ok = await konten.aenderePasswort((res.locals.konto as Konto).id, altesPasswort, neuesPasswort as string, sitzungsToken(req)!);
      if (!ok) {
        kontoAenderungBremse.merkeFehlversuch(ip);
        return void res.status(403).json({ fehler: 'Das aktuelle Passwort ist falsch.' });
      }
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ---- Passwort vergessen ----

  router.post('/passwort-vergessen', async (req, res, next) => {
    try {
      if (!mailversand.aktiv) {
        return void res.status(503).json({ fehler: 'Das Zurücksetzen per E-Mail ist noch nicht verfügbar. Bitte melde dich beim Team (Discord).' });
      }
      const ip = req.ip ?? 'unbekannt';
      const warten = vergessenBremse.gesperrtFuer(ip);
      if (warten > 0) return zuVieleVersuche(res, warten);
      vergessenBremse.merkeFehlversuch(ip);

      const { email } = req.body ?? {};
      if (pruefeEmail(email)) return void res.status(400).json({ fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' });

      // Gleiche Antwort, ob es das Konto gibt oder nicht – verrät keine registrierten Adressen
      const konto = konten.kontoNachEmail(email as string);
      if (konto?.email) {
        const { token } = konten.erstellePasswortToken(konto.id);
        await mailversand.sende({
          an: konto.email,
          betreff: 'LeitstellenDispo – Passwort zurücksetzen',
          text: [
            `Hallo ${konto.name},`,
            '',
            'du (oder jemand anderes) möchtest das Passwort für dein LeitstellenDispo-Konto zurücksetzen.',
            'Über diesen Link kannst du ein neues Passwort festlegen (1 Stunde gültig):',
            '',
            passwortLink(spielBasisUrl(req, optionen.spielUrl), token),
            '',
            'Wenn du das nicht warst, ignoriere diese Mail einfach – dein Passwort bleibt unverändert.',
          ].join('\n'),
        });
      }
      res.json({ hinweis: 'Wenn zu dieser Adresse ein Konto existiert, ist eine E-Mail mit einem Link unterwegs.' });
    } catch (e) {
      next(e);
    }
  });

  router.post('/passwort-zuruecksetzen', async (req, res, next) => {
    try {
      const ip = req.ip ?? 'unbekannt';
      const warten = zuruecksetzenBremse.gesperrtFuer(ip);
      if (warten > 0) return zuVieleVersuche(res, warten);
      const { token, passwort } = req.body ?? {};
      const fehler = pruefePasswort(passwort);
      if (fehler) return void res.status(400).json({ fehler });
      if (typeof token !== 'string' || token.length === 0) return void res.status(400).json({ fehler: 'Der Link ist unvollständig.' });

      const konto = await konten.setzePasswortMitToken(token, passwort as string);
      if (!konto) {
        zuruecksetzenBremse.merkeFehlversuch(ip);
        return void res.status(400).json({ fehler: 'Der Link ist ungültig oder abgelaufen. Fordere bitte einen neuen an.' });
      }
      res.json({ name: konto.name });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
