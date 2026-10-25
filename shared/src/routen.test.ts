import { afterEach, describe, expect, it } from 'vitest';
import { getFahrtVerlauf, getFahrzeitSekunden } from './geo.js';
import { GAME_CONFIG } from './konfig.js';
import { getRoute, leereRoutenSpeicher, nimmFehlendeRouten, punktAufLinie, speichereRoute } from './routen.js';
import type { Koordinaten } from './typen.js';

const von: Koordinaten = [48.775, 9.17];
const nach: Koordinaten = [48.785, 9.18];
// Umweg über eine Ecke: erst nach Norden, dann nach Osten
const ecke: Koordinaten = [48.785, 9.17];
const route = { dauerSekunden: 300, distanzKm: 2, punkte: [von, ecke, nach] };

afterEach(leereRoutenSpeicher);

describe('Straßen-Routen', () => {
  it('merkt fehlende Routen zum Nachladen vor, jede nur einmal', () => {
    expect(getRoute(von, nach)).toBeNull();
    getRoute(von, nach);
    expect(nimmFehlendeRouten()).toEqual([{ von, nach }]);
    expect(nimmFehlendeRouten()).toEqual([]);
  });

  it('nimmt mit Route die Navi-Zeit, angepasst an die Geschwindigkeit des Fahrzeugtyps', () => {
    const luftlinie = getFahrzeitSekunden(von, nach);
    speichereRoute({ von, nach }, route);
    expect(getFahrzeitSekunden(von, nach)).toBe(300);
    expect(getFahrzeitSekunden(von, nach, GAME_CONFIG.averageSpeedKmh * 2)).toBe(150);
    expect(luftlinie).not.toBe(300);
  });

  it('ohne Straßenroute (null) bleibt es bei der Luftlinie und es wird nicht erneut gefragt', () => {
    speichereRoute({ von, nach }, null);
    expect(getFahrtVerlauf(von, nach, 0, 1000, 500).linie).toHaveLength(2);
    expect(nimmFehlendeRouten()).toEqual([]);
  });

  it('Fahrzeug fährt entlang der Straße statt quer durch', () => {
    speichereRoute({ von, nach }, route);
    // Erst auf dem Nord-Stück (Längengrad bleibt), am Ende auf dem Ost-Stück (Breitengrad bleibt)
    expect(getFahrtVerlauf(von, nach, 0, 1000, 300).position[1]).toBeCloseTo(ecke[1], 6);
    const spaet = getFahrtVerlauf(von, nach, 0, 1000, 800);
    expect(spaet.position[0]).toBeCloseTo(ecke[0], 6);
    expect(spaet.linie).toEqual([spaet.position, nach]);
    expect(punktAufLinie(route.punkte, 1)).toEqual(nach);
  });
});
