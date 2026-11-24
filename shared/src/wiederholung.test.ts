import { describe, expect, it } from 'vitest';
import { mitWiederholung } from './wiederholung.js';

const sofort = async () => {};

describe('mitWiederholung', () => {
  it('versucht es nach Fehlern erneut, bis es klappt', async () => {
    let aufrufe = 0;
    const ergebnis = await mitWiederholung(async () => (++aufrufe < 3 ? undefined : 'Hauptstraße'), [1, 1, 1], sofort);
    expect(ergebnis).toBe('Hauptstraße');
    expect(aufrufe).toBe(3);
  });

  it('zählt geworfene Fehler als Fehlversuch', async () => {
    let aufrufe = 0;
    const ergebnis = await mitWiederholung(async () => {
      if (++aufrufe === 1) throw new Error('kein Netz');
      return 42;
    }, [1], sofort);
    expect(ergebnis).toBe(42);
  });

  it('gibt nach allen Versuchen auf und hört bei „gibt es nicht“ (null) sofort auf', async () => {
    let aufrufe = 0;
    expect(await mitWiederholung(async () => { aufrufe++; return undefined; }, [1, 1], sofort)).toBeUndefined();
    expect(aufrufe).toBe(3);
    aufrufe = 0;
    expect(await mitWiederholung(async () => { aufrufe++; return null; }, [1, 1], sofort)).toBeNull();
    expect(aufrufe).toBe(1);
  });

  it('wartet zwischen den Versuchen immer länger', async () => {
    const gewartet: number[] = [];
    await mitWiederholung(async () => undefined, [2, 5, 15], async (ms) => { gewartet.push(ms); });
    expect(gewartet).toEqual([2, 5, 15]);
  });
});
