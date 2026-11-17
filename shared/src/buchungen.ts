/**
 * Begrenzung der Buchungsliste: Ein Spielstand wächst sonst endlos (ca. 38 Buchungen je Spielstunde)
 * und wird irgendwann zu groß zum Speichern. Ältere Buchungen werden deshalb zu zwei Sammelbuchungen
 * zusammengefasst – „Einnahmen gesamt“ und „Ausgaben gesamt“ in den Finanzen stimmen dadurch weiterhin.
 */
import type { FinanceTransaction } from './typen.js';

/** So viele einzelne Buchungen bleiben erhalten (neueste zuerst) – reicht für mehrere Tage Spielzeit. */
export const BUCHUNGEN_LIMIT = 1000;

export const SAMMEL_EINNAHMEN_ID = 'fruehere-einnahmen';
export const SAMMEL_AUSGABEN_ID = 'fruehere-ausgaben';

export const SAMMEL_EINNAHMEN_LABEL = 'Frühere Einnahmen (zusammengefasst)';
export const SAMMEL_AUSGABEN_LABEL = 'Frühere Ausgaben (zusammengefasst)';

/**
 * Sammelbuchungen erklären kein neues Guthaben – sie fassen nur Vergangenes zusammen.
 * Die Plausibilitätsprüfung lässt ihre Beträge deshalb außen vor.
 */
export const istSammelBuchung = (tx: Pick<FinanceTransaction, 'id'>) =>
  tx.id === SAMMEL_EINNAHMEN_ID || tx.id === SAMMEL_AUSGABEN_ID;

/**
 * Kürzt die Buchungsliste auf `limit` Einträge. Was wegfällt, landet in den beiden Sammelbuchungen
 * (die dadurch wachsen). Die Liste ist neueste zuerst sortiert; die Sammelbuchungen stehen am Ende.
 */
export function kappeBuchungen(transactions: FinanceTransaction[], limit = BUCHUNGEN_LIMIT): FinanceTransaction[] {
  if (transactions.length <= limit) return transactions;

  const einzeln = transactions.filter((tx) => !istSammelBuchung(tx));
  const sammel = (id: string) => transactions.find((tx) => tx.id === id);
  if (einzeln.length <= limit) return transactions;

  const behalten = einzeln.slice(0, limit);
  const zusammenfassen = einzeln.slice(limit);
  const summe = (kind: FinanceTransaction['kind']) =>
    zusammenfassen.filter((tx) => tx.kind === kind).reduce((wert, tx) => wert + tx.amount, 0);

  const erstelleSammel = (id: string, kind: FinanceTransaction['kind'], label: string): FinanceTransaction | null => {
    const bisher = sammel(id);
    const betrag = (bisher?.amount ?? 0) + summe(kind);
    if (betrag <= 0) return null;
    // Zeitpunkt der ältesten zusammengefassten Buchung – so bleibt die Liste zeitlich plausibel
    const createdAt = zusammenfassen.at(-1)?.createdAt ?? bisher?.createdAt ?? new Date().toISOString();
    return { id, kind, label, amount: betrag, createdAt: bisher?.createdAt ?? createdAt };
  };

  return [
    ...behalten,
    ...[erstelleSammel(SAMMEL_EINNAHMEN_ID, 'Einnahme', SAMMEL_EINNAHMEN_LABEL),
      erstelleSammel(SAMMEL_AUSGABEN_ID, 'Ausgabe', SAMMEL_AUSGABEN_LABEL)]
      .filter((tx): tx is FinanceTransaction => tx !== null),
  ];
}
