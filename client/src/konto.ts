import type { Konto } from '@leitstellendispo/shared';

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
export const registrieren = (name: string, passwort: string) => sende('/registrieren', { name, passwort });

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
