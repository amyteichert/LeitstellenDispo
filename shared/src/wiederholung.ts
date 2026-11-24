/**
 * Wiederholt eine Anfrage an einen externen Dienst (Karte, Adresssuche), bis sie klappt.
 * Die Anfrage meldet `undefined`, wenn es sich lohnt, es nochmal zu versuchen (kein Netz, Dienst überlastet);
 * jedes andere Ergebnis (auch `null` = „gibt es nicht“) wird sofort zurückgegeben.
 */
export const WIEDERHOLUNG_WARTEZEITEN_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

export async function mitWiederholung<T>(
  anfrage: (versuch: number) => Promise<T | undefined>,
  wartezeitenMs: readonly number[] = WIEDERHOLUNG_WARTEZEITEN_MS,
  warten: (ms: number) => Promise<void> = (ms) => new Promise((fertig) => setTimeout(fertig, ms)),
): Promise<T | undefined> {
  for (let versuch = 0; ; versuch++) {
    let ergebnis: T | undefined;
    try {
      ergebnis = await anfrage(versuch);
    } catch {
      ergebnis = undefined;
    }
    if (ergebnis !== undefined || versuch >= wartezeitenMs.length) return ergebnis;
    await warten(wartezeitenMs[versuch]);
  }
}
