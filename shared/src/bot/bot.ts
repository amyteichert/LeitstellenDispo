/**
 * Der Bot: trifft Entscheidungen auf einem Spielstand – alarmiert Fahrzeuge,
 * kauft Fahrzeuge und baut (je nach Ziel) Wachen. Reine Funktionen, die auf
 * denselben shared-Aktionen aufsetzen wie die Spieler-UI.
 *
 * Ein `botSchritt` ist eine Runde Entscheidungen. Die Simulation ruft ihn
 * regelmäßig auf, dazwischen laufen Zeit, Einsatzerzeugung und Spiel-Tick.
 */
import { alarmiere, erstelleWache, kaufeFahrzeug } from '../aktionen.js';
import { erstelleAlarmVorschlag } from '../alarmierung.js';
import { formatEinsatzTitel, type SpielEinsatz } from '../daten.js';
import { FAHRZEUG_TYPEN, getBedarfsLabel, fahrzeugErfuelltBedarf, type BedarfsKlasse } from '../fahrzeuge.js';
import type { Spielstand } from '../spielstand.js';
import type { MapLocation, StationKind } from '../typen.js';
import { zufallsElement, zufallsZahl, type Zufall } from '../zufall.js';

/** Worauf der Bot hinarbeitet. */
export type BotZiel = 'einsaetze' | 'geld' | 'ausbauen' | 'schnell' | 'chaos';

export const BOT_ZIEL_LABELS: Record<BotZiel, string> = {
  einsaetze: 'Einsätze abarbeiten',
  geld: 'Geld maximieren',
  ausbauen: 'Leitstelle ausbauen',
  schnell: 'Schnellste Anfahrt',
  chaos: 'Chaos-Test (absichtlich Unsinn)',
};

export interface BotAktion {
  jetzt: number;
  art: 'alarm' | 'kauf' | 'bau' | 'chaos' | 'info';
  text: string;
}

export interface BotSchrittErgebnis {
  spielstand: Spielstand;
  aktionen: BotAktion[];
}

interface ZielRegel {
  /** Mindest-Rücklage, die der Bot nicht ausgibt */
  reserve: number;
  /** Baut der Bot neue Wachen? */
  baut: boolean;
  /** Wie viele Wachen der Bot maximal anstrebt */
  maxWachen: number;
}

const ZIEL_REGELN: Record<Exclude<BotZiel, 'chaos'>, ZielRegel> = {
  einsaetze: { reserve: 6000, baut: false, maxWachen: 4 },
  geld: { reserve: 10000, baut: false, maxWachen: 4 },
  ausbauen: { reserve: 4000, baut: true, maxWachen: 8 },
  schnell: { reserve: 5000, baut: true, maxWachen: 12 },
};

/** Günstigster Fahrzeugtyp, der eine Bedarfsklasse erfüllen kann. */
const guenstigsterTypFuer = (klasse: BedarfsKlasse) =>
  FAHRZEUG_TYPEN
    .filter((typ) => fahrzeugErfuelltBedarf(typ.typ, klasse))
    .sort((a, b) => a.preis - b.preis)[0];

const istOffen = (incident: SpielEinsatz) => incident.status === 'offen' || incident.status === 'alarmiert';

/**
 * Eine Entscheidungsrunde des Bots.
 * 1. Alle offenen Einsätze mit freien, passenden Fahrzeugen alarmieren.
 * 2. Nach Ziel: Fahrzeuge (und ggf. Wachen) kaufen, um Unterdeckung zu schließen.
 * Beim Ziel „chaos“ macht der Bot stattdessen absichtlich Unsinn (Härtetest).
 */
export function botSchritt(
  spielstand: Spielstand,
  ziel: BotZiel,
  jetzt: number = Date.now(),
  zufall: Zufall = Math.random,
): BotSchrittErgebnis {
  if (ziel === 'chaos') return chaosSchritt(spielstand, jetzt, zufall);

  const aktionen: BotAktion[] = [];
  let aktuell = spielstand;

  // 1. Alarmieren
  for (const incident of aktuell.incidents.filter(istOffen)) {
    const vorschlag = erstelleAlarmVorschlag(incident, {
      incidents: aktuell.incidents,
      vehicles: aktuell.vehicles,
      locations: aktuell.locations,
    });
    if (vorschlag.fahrzeugIds.length > 0) {
      aktuell = alarmiere(aktuell, incident.id, vorschlag.fahrzeugIds, jetzt);
      aktionen.push({
        jetzt,
        art: 'alarm',
        text: `${vorschlag.fahrzeugIds.length}× alarmiert zu „${formatEinsatzTitel(incident)}“ (${incident.address})`,
      });
    }
  }

  // 2. Kaufen / Bauen gegen Unterdeckung
  const regel = ZIEL_REGELN[ziel];
  const kauf = kaufeGegenUnterdeckung(aktuell, regel, jetzt, zufall);
  aktuell = kauf.spielstand;
  aktionen.push(...kauf.aktionen);

  return { spielstand: aktuell, aktionen };
}

/** Deckt die dringendste Unterdeckung durch EIN Fahrzeug bzw. eine neue Wache pro Runde. */
function kaufeGegenUnterdeckung(
  spielstand: Spielstand,
  regel: ZielRegel,
  jetzt: number,
  zufall: Zufall,
): BotSchrittErgebnis {
  // Welche Bedarfsklasse kann aktuell am häufigsten nicht gedeckt werden?
  const fehlendeKlassen = new Map<BedarfsKlasse, number>();
  for (const incident of spielstand.incidents.filter(istOffen)) {
    const vorschlag = erstelleAlarmVorschlag(incident, {
      incidents: spielstand.incidents,
      vehicles: spielstand.vehicles,
      locations: spielstand.locations,
    });
    for (const fehlt of vorschlag.nichtVerfuegbar) {
      fehlendeKlassen.set(fehlt.category, (fehlendeKlassen.get(fehlt.category) ?? 0) + fehlt.anzahl);
    }
  }
  if (fehlendeKlassen.size === 0) return { spielstand, aktionen: [] };

  const [klasse] = [...fehlendeKlassen.entries()].sort((a, b) => b[1] - a[1])[0];
  const typ = guenstigsterTypFuer(klasse);
  if (!typ) return { spielstand, aktionen: [] };

  const anzahlWachen = spielstand.locations.filter((location) => location.type === 'station').length;

  // Ausbau-Ziele erweitern bei anhaltendem Bedarf und genug Rücklage lieber das Netz,
  // statt immer nur an derselben Wache nachzukaufen (verteilt die Last, kürzere Anfahrten).
  if (regel.baut && anzahlWachen < regel.maxWachen && spielstand.balance > regel.reserve + 25000) {
    return baueWache(spielstand, typ.wachenArt, typ.typ, regel, jetzt, zufall);
  }

  // Gibt es eine passende Wache mit Budget für den Kauf?
  const passendeWache = spielstand.locations.find(
    (location) => location.type === 'station' && (location.stationKind ?? 'Rettungswache') === typ.wachenArt,
  );

  if (passendeWache) {
    if (spielstand.balance - typ.preis < regel.reserve) return { spielstand, aktionen: [] };
    const ergebnis = kaufeFahrzeug(spielstand, passendeWache.id, typ.typ, jetzt, zufall);
    if ('spielstand' in ergebnis) {
      return {
        spielstand: ergebnis.spielstand,
        aktionen: [{ jetzt, art: 'kauf', text: `${typ.typ} für ${passendeWache.name} gekauft (${typ.preis} €) – fehlte: ${getBedarfsLabel(klasse)}` }],
      };
    }
    return { spielstand, aktionen: [] };
  }

  // Keine passende Wache vorhanden → nur bauen, wenn das Ziel es erlaubt
  if (!regel.baut) return { spielstand, aktionen: [] };
  if (anzahlWachen >= regel.maxWachen) return { spielstand, aktionen: [] };
  return baueWache(spielstand, typ.wachenArt, typ.typ, regel, jetzt, zufall);
}

/** Baut eine neue Wache in der Nähe einer bestehenden, mit dem passenden Startfahrzeug. */
function baueWache(
  spielstand: Spielstand,
  wachenArt: StationKind,
  startFahrzeugTyp: string,
  regel: ZielRegel,
  jetzt: number,
  zufall: Zufall,
): BotSchrittErgebnis {
  const basis = spielstand.locations.find((location) => location.type === 'station') ?? START_BASIS;
  const coords: [number, number] = [
    basis.coords[0] + (zufall() - 0.5) * 0.08,
    basis.coords[1] + (zufall() - 0.5) * 0.08,
  ];
  const nummer = spielstand.locations.filter((location) => location.type === 'station').length + 1;
  const ergebnis = erstelleWache(spielstand, {
    name: `${wachenArt} ${nummer}`,
    stationKind: wachenArt,
    coords,
    details: 'Vom Bot gebaut',
    startFahrzeugTyp,
    funkrufname: '',
  }, jetzt, zufall);

  if ('spielstand' in ergebnis) {
    // Nur behalten, wenn danach noch Rücklage bleibt – sonst verwirft der Bot den Bau
    if (ergebnis.spielstand.balance < regel.reserve) return { spielstand, aktionen: [] };
    return {
      spielstand: ergebnis.spielstand,
      aktionen: [{ jetzt, art: 'bau', text: `${wachenArt} „${wachenArt} ${nummer}“ mit ${startFahrzeugTyp} gebaut` }],
    };
  }
  return { spielstand, aktionen: [] };
}

const START_BASIS: Pick<MapLocation, 'coords'> = { coords: [48.775, 9.1771] };

// ---------------------------------------------------------------------------
// Chaos-Ziel: absichtlich Unsinn, um das Spiel zu stressen (siehe auch chaos.ts)
// ---------------------------------------------------------------------------

/** Macht pro Runde eine zufällige, oft unsinnige Aktion – soll nie abstürzen. */
function chaosSchritt(spielstand: Spielstand, jetzt: number, zufall: Zufall): BotSchrittErgebnis {
  const aktionen: BotAktion[] = [];
  const wuerfel = zufallsZahl(zufall, 0, 4);

  if (wuerfel === 0) {
    // Zufällige (evtl. ungültige) Fahrzeuge zu einem zufälligen Einsatz alarmieren
    const incident = zufallsElement(zufall, spielstand.incidents);
    const vehicleIds = [zufallsElement(zufall, spielstand.vehicles)?.id ?? 'gibt-es-nicht', 'erfundene-id'];
    if (incident) {
      const nachher = alarmiere(spielstand, incident.id, vehicleIds, jetzt);
      aktionen.push({ jetzt, art: 'chaos', text: `Chaos: wahllose Alarmierung zu ${incident.id}` });
      return { spielstand: nachher, aktionen };
    }
  } else if (wuerfel === 1) {
    // Kauf an einer evtl. nicht existierenden Wache mit evtl. falschem Typ
    const station = zufallsElement(zufall, spielstand.locations);
    const typ = zufallsElement(zufall, FAHRZEUG_TYPEN);
    const ergebnis = kaufeFahrzeug(spielstand, station?.id ?? 'keine-wache', typ?.typ ?? 'kein-typ', jetzt, zufall);
    aktionen.push({ jetzt, art: 'chaos', text: `Chaos: Kaufversuch (${typ?.typ ?? '?'} @ ${station?.name ?? '?'})` });
    return { spielstand: 'spielstand' in ergebnis ? ergebnis.spielstand : spielstand, aktionen };
  } else if (wuerfel === 2) {
    // Dasselbe Fahrzeug mehrfach zum selben Einsatz
    const incident = zufallsElement(zufall, spielstand.incidents.filter(istOffen));
    const vehicle = zufallsElement(zufall, spielstand.vehicles);
    if (incident && vehicle) {
      const nachher = alarmiere(spielstand, incident.id, [vehicle.id, vehicle.id, vehicle.id], jetzt);
      aktionen.push({ jetzt, art: 'chaos', text: `Chaos: ${vehicle.callsign ?? vehicle.id} mehrfach alarmiert` });
      return { spielstand: nachher, aktionen };
    }
  }

  // sonst: nichts tun (Einsätze absichtlich ignorieren)
  aktionen.push({ jetzt, art: 'chaos', text: 'Chaos: Einsätze absichtlich ignoriert' });
  return { spielstand, aktionen };
}
