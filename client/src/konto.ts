import type {
  Ankuendigung,
  AnkuendigungsArt,
  Konto,
  KontoNotiz,
  SpielstandKorrektur,
  SpielstandZusammenfassung,
  TeamKonto,
  TeamProtokollEintrag,
  TeamUebersicht,
  UserRole,
} from '@leitstellendispo/shared';

/** Wird ausgelöst, wenn der Server eine Anfrage mit 401 ablehnt (Sitzung abgelaufen oder Konto gesperrt). */
export const SITZUNG_ABGELAUFEN = 'leitstellendispo:sitzung-abgelaufen';

export function meldeSitzungAbgelaufen() {
  window.dispatchEvent(new Event(SITZUNG_ABGELAUFEN));
}

export class KontoFehler extends Error {}

const SERVER_NICHT_ERREICHBAR = 'Der Server ist nicht erreichbar. Läuft er?';

/** Fehlertext zu einer fehlgeschlagenen Antwort. Ohne Server antwortet der Vite-Proxy mit 5xx und ohne JSON. */
function fehlerText(res: Response, daten: { fehler?: string } | null): string {
  if (daten?.fehler) return daten.fehler;
  return res.status >= 500 ? SERVER_NICHT_ERREICHBAR : `Unerwarteter Fehler (${res.status}).`;
}

async function sende(pfad: string, body?: unknown): Promise<Konto> {
  let res: Response;
  try {
    res = await fetch(`/api/auth${pfad}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new KontoFehler(SERVER_NICHT_ERREICHBAR);
  }
  const daten = await res.json().catch(() => null);
  if (!res.ok) throw new KontoFehler(fehlerText(res, daten));
  return daten.konto as Konto;
}

export const anmelden = (name: string, passwort: string) => sende('/anmelden', { name, passwort });
export const registrieren = (name: string, email: string, passwort: string) => sende('/registrieren', { name, email, passwort });

/** Anfrage an /api/auth, die kein Konto zurückgibt */
async function auth<T>(pfad: string, body?: unknown, methode = 'POST'): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/auth${pfad}`, {
      method: methode,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new KontoFehler(SERVER_NICHT_ERREICHBAR);
  }
  const daten = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new KontoFehler(fehlerText(res, daten));
  return daten as T;
}

/** Welche Konto-Funktionen der Server gerade anbietet */
export const holeFunktionen = () => auth<{ passwortVergessen: boolean }>('/funktionen', undefined, 'GET').catch(() => ({ passwortVergessen: false }));
export const aendereEmail = (email: string, passwort: string) => auth<{ konto: Konto }>('/email', { email, passwort }).then((d) => d.konto);
export const aenderePasswort = (altesPasswort: string, neuesPasswort: string) => auth<null>('/passwort', { altesPasswort, neuesPasswort });
export const passwortVergessen = (email: string) => auth<{ hinweis: string }>('/passwort-vergessen', { email }).then((d) => d.hinweis);
export const passwortZuruecksetzen = (token: string, passwort: string) => auth<{ name: string }>('/passwort-zuruecksetzen', { token, passwort }).then((d) => d.name);

/** Angemeldetes Konto laut Server – `null`, wenn keine gültige Sitzung besteht. Wirft, wenn der Server nicht erreichbar ist. */
export async function holeKonto(): Promise<Konto | null> {
  let res: Response;
  try {
    res = await fetch('/api/auth/ich');
  } catch {
    throw new KontoFehler(SERVER_NICHT_ERREICHBAR);
  }
  if (res.status === 401) return null;
  if (!res.ok) throw new KontoFehler(fehlerText(res, await res.json().catch(() => null)));
  return ((await res.json()) as { konto: Konto }).konto;
}

export async function abmelden(): Promise<void> {
  await fetch('/api/auth/abmelden', { method: 'POST' }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Team-Bereich (Server prüft jede Aktion – die Oberfläche blendet nur aus)
// ---------------------------------------------------------------------------

async function team<T>(methode: string, pfad: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/team${pfad}`, {
      method: methode,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new KontoFehler(SERVER_NICHT_ERREICHBAR);
  }
  if (res.status === 401) meldeSitzungAbgelaufen();
  const daten = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new KontoFehler(fehlerText(res, daten));
  return daten as T;
}

export const teamApi = {
  uebersicht: () => team<{ uebersicht: TeamUebersicht }>('GET', '/uebersicht').then((d) => d.uebersicht),
  konten: (suche = '') => team<{ konten: TeamKonto[] }>('GET', `/konten?suche=${encodeURIComponent(suche)}`).then((d) => d.konten),
  spielstand: (id: number) => team<{ zusammenfassung: SpielstandZusammenfassung | null }>('GET', `/konten/${id}/spielstand`).then((d) => d.zusammenfassung),
  sperren: (id: number, gesperrt: boolean) => team<{ konto: TeamKonto }>('POST', `/konten/${id}/sperren`, { gesperrt }).then((d) => d.konto),
  rolle: (id: number, rolle: UserRole) => team<{ konto: TeamKonto }>('POST', `/konten/${id}/rolle`, { rolle }).then((d) => d.konto),
  spielstandZuruecksetzen: (id: number) => team<null>('DELETE', `/konten/${id}/spielstand`),
  loeschen: (id: number) => team<null>('DELETE', `/konten/${id}`),
  devMarkierung: () => team<null>('POST', '/dev-markierung'),
  passwortLink: (id: number) => team<{ link: string; laeuftAb: number }>('POST', `/konten/${id}/passwort-link`),
  protokoll: () => team<{ eintraege: TeamProtokollEintrag[] }>('GET', '/protokoll').then((d) => d.eintraege),
  notizen: (id: number) => team<{ notizen: KontoNotiz[] }>('GET', `/konten/${id}/notizen`).then((d) => d.notizen),
  notizAnlegen: (id: number, text: string) => team<{ notizen: KontoNotiz[] }>('POST', `/konten/${id}/notizen`, { text }).then((d) => d.notizen),
  notizLoeschen: (notizId: number) => team<null>('DELETE', `/notizen/${notizId}`),
  ankuendigungSetzen: (text: string, art: AnkuendigungsArt) =>
    team<{ ankuendigung: Ankuendigung }>('PUT', '/ankuendigung', { text, art }).then((d) => d.ankuendigung),
  ankuendigungEntfernen: () => team<null>('DELETE', '/ankuendigung'),
  korrekturen: (id: number) =>
    team<{ korrekturen: Array<SpielstandKorrektur & { eingebucht: number }> }>('GET', `/konten/${id}/korrekturen`).then((d) => d.korrekturen),
  korrekturAnlegen: (id: number, korrektur: { guthabenAenderung: number; rufNeu: number | null; grund: string }) =>
    team<{ korrekturen: Array<SpielstandKorrektur & { eingebucht: number }> }>('POST', `/konten/${id}/korrekturen`, korrektur).then((d) => d.korrekturen),
};

// ---------------------------------------------------------------------------
// Für alle Spieler: Ankündigung des Teams und Korrekturen am eigenen Spielstand
// ---------------------------------------------------------------------------

/** Aktuelle Ankündigung – `null`, wenn keine aktiv ist oder der Server nicht erreichbar ist (nur Komfort). */
export async function ladeAnkuendigung(): Promise<Ankuendigung | null> {
  try {
    const res = await fetch('/api/ankuendigung');
    if (!res.ok) return null;
    return ((await res.json()) as { ankuendigung: Ankuendigung | null }).ankuendigung;
  } catch {
    return null;
  }
}

/** Offene Korrekturen des Teams am eigenen Spielstand (leer, wenn der Server nicht erreichbar ist). */
export async function ladeKorrekturen(): Promise<SpielstandKorrektur[]> {
  try {
    const res = await fetch('/api/spielstand/korrekturen');
    if (!res.ok) return [];
    return ((await res.json()) as { korrekturen: SpielstandKorrektur[] }).korrekturen;
  } catch {
    return [];
  }
}

/** Bestätigt eingebuchte Korrekturen – danach liefert der Server sie nicht mehr aus. */
export async function bestaetigeKorrekturen(ids: number[]): Promise<boolean> {
  try {
    const res = await fetch('/api/spielstand/korrekturen/eingebucht', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
