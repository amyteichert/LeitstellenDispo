import { describe, expect, it } from 'vitest';
import {
  BUCHUNGEN_LIMIT,
  SAMMEL_AUSGABEN_ID,
  SAMMEL_EINNAHMEN_ID,
  kappeBuchungen,
} from './buchungen.js';
import { pruefeGuthaben } from './plausibilitaet.js';
import type { FinanceTransaction } from './typen.js';

const tx = (id: string, kind: FinanceTransaction['kind'], amount: number): FinanceTransaction =>
  ({ id, kind, amount, label: 'Einsatz', createdAt: '2026-11-17T04:00:00.000Z' });

/** `anzahl` Buchungen, abwechselnd Einnahme (100 €) und Ausgabe (40 €) */
const viele = (anzahl: number) =>
  Array.from({ length: anzahl }, (_, i) => tx(`t${i}`, i % 2 === 0 ? 'Einnahme' : 'Ausgabe', i % 2 === 0 ? 100 : 40));

const summe = (liste: FinanceTransaction[], kind: FinanceTransaction['kind']) =>
  liste.filter((t) => t.kind === kind).reduce((wert, t) => wert + t.amount, 0);

describe('kappeBuchungen', () => {
  it('lässt kurze Listen unverändert (gleiches Objekt, kein unnötiges Neuzeichnen)', () => {
    const liste = viele(10);
    expect(kappeBuchungen(liste)).toBe(liste);
  });

  it('kürzt auf das Limit und behält die Summen über die Sammelbuchungen', () => {
    const liste = viele(BUCHUNGEN_LIMIT + 500);
    const gekappt = kappeBuchungen(liste);

    expect(gekappt.length).toBe(BUCHUNGEN_LIMIT + 2);
    expect(summe(gekappt, 'Einnahme')).toBe(summe(liste, 'Einnahme'));
    expect(summe(gekappt, 'Ausgabe')).toBe(summe(liste, 'Ausgabe'));
    // Die neuesten Buchungen bleiben einzeln sichtbar
    expect(gekappt[0].id).toBe('t0');
    expect(gekappt.some((t) => t.id === SAMMEL_EINNAHMEN_ID)).toBe(true);
    expect(gekappt.some((t) => t.id === SAMMEL_AUSGABEN_ID)).toBe(true);
  });

  it('fasst beim nächsten Kappen in dieselben Sammelbuchungen zusammen', () => {
    const erste = kappeBuchungen(viele(BUCHUNGEN_LIMIT + 100));
    const spaeter = kappeBuchungen([...viele(200).map((t) => ({ ...t, id: `neu-${t.id}` })), ...erste]);

    expect(spaeter.filter((t) => t.id === SAMMEL_EINNAHMEN_ID)).toHaveLength(1);
    expect(summe(spaeter, 'Einnahme')).toBe(summe(viele(BUCHUNGEN_LIMIT + 100), 'Einnahme') + summe(viele(200), 'Einnahme'));
  });

  it('erzeugt keine leere Sammelbuchung, wenn es nur Einnahmen gibt', () => {
    const nurEinnahmen = Array.from({ length: BUCHUNGEN_LIMIT + 50 }, (_, i) => tx(`e${i}`, 'Einnahme', 10));
    const gekappt = kappeBuchungen(nurEinnahmen);
    expect(gekappt.some((t) => t.id === SAMMEL_AUSGABEN_ID)).toBe(false);
    expect(summe(gekappt, 'Einnahme')).toBe(summe(nurEinnahmen, 'Einnahme'));
  });

  it('löst beim Schummelschutz keinen Fehlalarm aus (Kappen ändert das Guthaben nicht)', () => {
    const alt = { balance: 50_000, transactions: viele(BUCHUNGEN_LIMIT + 300) };
    const neu = { balance: 50_000, transactions: kappeBuchungen(alt.transactions) };
    expect(pruefeGuthaben(alt, neu)).toMatchObject({ unerklaert: 0, erlaubtesGuthaben: 50_000 });
  });

  it('erlaubt kein zusätzliches Guthaben über eine aufgeblähte Sammelbuchung', () => {
    const basis = kappeBuchungen(viele(BUCHUNGEN_LIMIT + 300));
    const alt = { balance: 50_000, transactions: basis };
    // Schummelversuch: Sammelbuchung um 1 Mio € erhöhen
    const manipuliert = basis.map((t) => (t.id === SAMMEL_EINNAHMEN_ID ? { ...t, amount: t.amount + 1_000_000 } : t));
    const neu = { balance: 1_050_000, transactions: manipuliert };
    expect(pruefeGuthaben(alt, neu).erlaubtesGuthaben).toBe(50_000);
  });
});
