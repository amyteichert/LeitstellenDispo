/**
 * Welches Symbol ein Einsatz auf Karte und in Listen bekommt – abgeleitet aus Stichwort und Meldebild,
 * damit neue Einsatzvorlagen automatisch ein passendes Symbol haben.
 */
import type { Einsatz } from './daten.js';

export type EinsatzSymbol =
  | 'brand'
  | 'alarm'
  | 'patient'
  | 'herz'
  | 'verkehrsunfall'
  | 'technik'
  | 'baum'
  | 'wasser'
  | 'tier'
  | 'tuer'
  | 'krankentransport';

/** Reihenfolge zählt: Die erste passende Regel gewinnt (z. B. „Baum auf PKW“ = Baum, nicht Verkehrsunfall). */
const MELDEBILD_REGELN: Array<[RegExp, EinsatzSymbol]> = [
  [/brandmeldeanlage|rauchmelder/, 'alarm'],
  [/baum/, 'baum'],
  [/verkehrsunfall|^vu\b|unfall/, 'verkehrsunfall'],
  [/wasser|ölspur/, 'wasser'],
  [/tier/, 'tier'],
  [/(^|\s)tür/, 'tuer'],
  [/reanimation|brustschmerz/, 'herz'],
];

export function getEinsatzSymbol(einsatz: Pick<Einsatz, 'stichwort' | 'meldebild'>): EinsatzSymbol {
  const stichwort = einsatz.stichwort.toUpperCase();
  const meldebild = einsatz.meldebild.toLowerCase();
  if (stichwort.startsWith('KTP')) return 'krankentransport';
  const regel = MELDEBILD_REGELN.find(([muster]) => muster.test(meldebild));
  if (regel) return regel[1];
  if (stichwort.startsWith('B')) return 'brand';
  if (stichwort.startsWith('TH')) return 'technik';
  return 'patient';
}
