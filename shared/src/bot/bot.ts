/**
 * Der Bot: trifft Entscheidungen auf einem Spielstand – baut Wachen, kauft (und besetzt)
 * Fahrzeuge und alarmiert zu Einsätzen. Reine Funktionen auf dem echten v5-Spielstand.
 *
 * Wichtig: In dieser Version startet man OHNE Wache. Der Bot baut daher zuerst eine
 * Rettungswache, bevor überhaupt Einsätze entstehen können.
 *
 * Bewusst NICHT nachgebildet (Sandbox-Vereinfachung): Zufriedenheit, Bewerber-Wechsel,
 * Kündigungen, Ausbildung und Funk. Fahrzeuge werden beim Kauf voll (qualifiziert) besetzt.
 */
import { alarmiereFahrzeuge, erstelleAlarmVorschlag } from '../alarmierung.js';
import { formatEinsatzTitel, getWachenPreis, type SpielEinsatz } from '../daten.js';
import { FAHRZEUG_TYPEN, fahrzeugErfuelltBedarf, type BedarfsKlasse, type FahrzeugTyp } from '../fahrzeuge.js';
import { erzeugeBesatzungFuer, synchronisiereBesatzung } from '../personal.js';
import { getLaufendeKosten } from '../kosten.js';
import { getStellplatzPreis, hatFreienStellplatz, mitStellplatzErweiterung } from '../wachen.js';
import type { Spielstand } from '../spielstand.js';
import type { FinanceTransaction, MapLocation, StationKind, Vehicle } from '../typen.js';
import { zufallsElement, zufallsZahl, type Zufall } from './zufall.js';

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
  art: 'alarm' | 'kauf' | 'bau' | 'ausbau' | 'chaos' | 'info';
  text: string;
}

export interface BotSchrittErgebnis {
  spielstand: Spielstand;
  aktionen: BotAktion[];
}

interface ZielRegel {
  reserve: number;
  baut: boolean;
  maxWachen: number;
}

const ZIEL_REGELN: Record<Exclude<BotZiel, 'chaos'>, ZielRegel> = {
  einsaetze: { reserve: 8000, baut: false, maxWachen: 4 },
  geld: { reserve: 15000, baut: false, maxWachen: 4 },
  ausbauen: { reserve: 6000, baut: true, maxWachen: 8 },
  schnell: { reserve: 8000, baut: true, maxWachen: 12 },
};

const istOffen = (incident: SpielEinsatz) => incident.status === 'offen' || incident.status === 'alarmiert';

/**
 * Sinnvolles Startfahrzeug einer Wachenart: für die Rettungswache ein RTW (kann als Einziger
 * Patienten versorgen UND transportieren – sonst entstehen keine machbaren Einsätze),
 * für die Feuerwache das günstigste startfähige Löschfahrzeug.
 */
const startTypFuer = (art: StationKind): FahrzeugTyp | undefined => {
  const startfaehig = FAHRZEUG_TYPEN.filter((typ) => typ.wachenArt === art && !typ.keinStartfahrzeug && !typ.brauchtEigenesKrankenhaus);
  if (art === 'Rettungswache') {
    return startfaehig.find((typ) => typ.typ === 'RTW') ?? startfaehig.find((typ) => typ.kategorie === 'RTW') ?? startfaehig[0];
  }
  return [...startfaehig].sort((a, b) => a.preis - b.preis)[0];
};

/** Günstigster kaufbarer Fahrzeugtyp, der eine Bedarfsklasse erfüllt (ohne „braucht Krankenhaus“). */
const kaufTypFuer = (klasse: BedarfsKlasse): FahrzeugTyp | undefined =>
  FAHRZEUG_TYPEN
    .filter((typ) => !typ.brauchtEigenesKrankenhaus && fahrzeugErfuelltBedarf(typ.typ, klasse))
    .sort((a, b) => a.preis - b.preis)[0];

const START_COORDS: [number, number] = [48.775, 9.1771];

/** Laufende Kosten (€/Stunde) des aktuellen Spielstands. */
const kostenProStunde = (s: Spielstand): number =>
  getLaufendeKosten({ locations: s.locations, vehicles: s.vehicles, personal: s.personal ?? [], krankenhaeuser: s.krankenhaeuser }).gesamt;

/** Einnahmen der letzten Stunde Spielzeit (≈ Einkommen pro Stunde) – Grundlage für „lohnt sich Ausbau?“. */
const einkommenProStunde = (s: Spielstand, jetzt: number): number =>
  (s.completedIncidentHistory ?? [])
    .filter((e) => typeof e.completedAt === 'number' && e.completedAt > jetzt - 3_600_000)
    .reduce((summe, e) => summe + (e.reward ?? 0) + (e.bewertung?.bonus ?? 0), 0);

const mitTransaktion = (transactions: FinanceTransaction[], label: string, amount: number, jetzt: number): FinanceTransaction[] => [
  { id: `txn-${jetzt}-${Math.round(Math.random() * 1e6)}`, kind: 'Ausgabe', label, amount, createdAt: new Date(jetzt).toISOString() },
  ...transactions,
];

/** Fügt ein Fahrzeug samt voll qualifizierter Besatzung hinzu und synchronisiert die Besatzungsdaten. */
function mitNeuemFahrzeug(spielstand: Spielstand, fahrzeug: Vehicle, zufall: Zufall): Spielstand {
  const personal = [...(spielstand.personal ?? []), ...erzeugeBesatzungFuer(fahrzeug, zufall)];
  const vehicles = synchronisiereBesatzung([...spielstand.vehicles, fahrzeug], personal);
  return { ...spielstand, vehicles, personal };
}

/** Baut eine neue Wache mit einem voll besetzten Startfahrzeug. */
function baueWache(spielstand: Spielstand, art: StationKind, jetzt: number, zufall: Zufall, coords: [number, number]): BotSchrittErgebnis {
  const anzahlWachen = spielstand.locations.filter((location) => location.type === 'station').length;
  const typ = startTypFuer(art);
  if (!typ) return { spielstand, aktionen: [] };
  const stationPreis = getWachenPreis(art, anzahlWachen);
  const gesamt = stationPreis + typ.preis;
  if (spielstand.balance < gesamt) return { spielstand, aktionen: [] };

  const nummer = anzahlWachen + 1;
  const locationId = `bot-wache-${jetzt}-${zufallsZahl(zufall, 1000, 9999)}`;
  const neueWache: MapLocation = {
    id: locationId,
    name: `${art} ${nummer}`,
    type: 'station',
    stationKind: art,
    coords,
    description: art === 'Feuerwache' ? 'Feuerwehr' : 'Rettungsdienst',
    details: 'Vom Bot gebaut',
    price: stationPreis,
  };
  const fahrzeug: Vehicle = {
    id: `bot-fz-${jetzt}-${zufallsZahl(zufall, 1000, 9999)}`,
    name: typ.typ,
    type: typ.typ,
    stationId: locationId,
    price: typ.preis,
    callsign: `${typ.typ}-${nummer}`,
    status: 'Einsatzbereit',
  };

  let neu: Spielstand = {
    ...spielstand,
    balance: spielstand.balance - gesamt,
    transactions: mitTransaktion(spielstand.transactions, `${art} „${neueWache.name}“ mit ${typ.typ} gebaut`, gesamt, jetzt),
    locations: [...spielstand.locations, neueWache],
  };
  neu = mitNeuemFahrzeug(neu, fahrzeug, zufall);
  return { spielstand: neu, aktionen: [{ jetzt, art: 'bau', text: `${art} „${neueWache.name}“ mit ${typ.typ} gebaut (${gesamt} €)` }] };
}

/** Kauft ein Fahrzeug an einer Wache mit freiem Stellplatz und besetzt es voll. */
function kaufeFahrzeug(spielstand: Spielstand, station: MapLocation, typ: FahrzeugTyp, jetzt: number, zufall: Zufall): BotSchrittErgebnis {
  if (spielstand.balance < typ.preis) return { spielstand, aktionen: [] };
  const nummer = spielstand.vehicles.filter((v) => v.type === typ.typ).length + 1;
  const fahrzeug: Vehicle = {
    id: `bot-fz-${jetzt}-${zufallsZahl(zufall, 1000, 9999)}`,
    name: typ.typ,
    type: typ.typ,
    stationId: station.id,
    price: typ.preis,
    callsign: `${typ.typ}-${nummer}`,
    status: 'Einsatzbereit',
  };
  let neu: Spielstand = {
    ...spielstand,
    balance: spielstand.balance - typ.preis,
    transactions: mitTransaktion(spielstand.transactions, `${typ.typ} für ${station.name} gekauft`, typ.preis, jetzt),
  };
  neu = mitNeuemFahrzeug(neu, fahrzeug, zufall);
  return { spielstand: neu, aktionen: [{ jetzt, art: 'kauf', text: `${typ.typ} für ${station.name} gekauft (${typ.preis} €)` }] };
}

/**
 * Eine Entscheidungsrunde des Bots.
 * 1. Ohne Wache: zuerst eine Rettungswache bauen.
 * 2. Offene Einsätze mit passenden freien Fahrzeugen alarmieren.
 * 3. Nach Ziel: gegen Unterdeckung Fahrzeuge kaufen bzw. Wachen/Stellplätze ausbauen.
 * Ziel „chaos“: absichtlich Unsinn (Härtetest im Betrieb).
 */
export function botSchritt(spielstand: Spielstand, ziel: BotZiel, jetzt: number = Date.now(), zufall: Zufall = Math.random): BotSchrittErgebnis {
  if (ziel === 'chaos') return chaosSchritt(spielstand, jetzt, zufall);

  const regel = ZIEL_REGELN[ziel];
  const aktionen: BotAktion[] = [];
  let aktuell = spielstand;

  const stationen = () => aktuell.locations.filter((location) => location.type === 'station');

  // 1. Erste Wache bauen, wenn es noch keine gibt
  if (stationen().length === 0) {
    const bau = baueWache(aktuell, 'Rettungswache', jetzt, zufall, START_COORDS);
    aktuell = bau.spielstand;
    aktionen.push(...bau.aktionen);
    return { spielstand: aktuell, aktionen }; // nächste Runde: alarmieren
  }

  // 2. Alarmieren
  for (const incident of aktuell.incidents.filter(istOffen)) {
    const vorschlag = erstelleAlarmVorschlag(incident, { incidents: aktuell.incidents, vehicles: aktuell.vehicles, locations: aktuell.locations });
    if (vorschlag.fahrzeugIds.length > 0) {
      const ergebnis = alarmiereFahrzeuge({ incidents: aktuell.incidents, vehicles: aktuell.vehicles, locations: aktuell.locations }, incident.id, vorschlag.fahrzeugIds, jetzt);
      aktuell = { ...aktuell, incidents: ergebnis.incidents, vehicles: ergebnis.vehicles };
      aktionen.push({ jetzt, art: 'alarm', text: `${vorschlag.fahrzeugIds.length}× alarmiert zu „${formatEinsatzTitel(incident)}“ (${incident.address})` });
    }
  }

  // 3. Wirtschaftlich handeln: immer einen Puffer (mehrere Stunden laufende Kosten) behalten,
  //    und nur ausbauen, wenn es sich rechnet (Einnahmen ≥ Kosten). Das verhindert, dass sich
  //    der Bot durch zu viele Fahrzeuge/Wachen ins Minus wirtschaftet.
  const kostenH = kostenProStunde(aktuell);
  const einkommenH = einkommenProStunde(aktuell, jetzt);
  const puffer = regel.reserve + kostenH * 6;
  const profitabel = einkommenH >= kostenH;

  // 3a. Ausbau-Ziele: proaktiv das Netz vergrößern – nur wenn profitabel und deutlich im Plus
  if (regel.baut && profitabel && stationen().length < regel.maxWachen && aktuell.balance > puffer + 50000) {
    const basis = stationen()[0];
    const coords: [number, number] = [basis.coords[0] + (zufall() - 0.5) * 0.1, basis.coords[1] + (zufall() - 0.5) * 0.1];
    const bau = baueWache(aktuell, 'Rettungswache', jetzt, zufall, coords);
    if (bau.aktionen.length > 0) {
      return { spielstand: bau.spielstand, aktionen: [...aktionen, ...bau.aktionen] };
    }
  }

  // 3b. Gegen Unterdeckung kaufen / ausbauen (eine Maßnahme pro Runde, immer mit Puffer)
  const kauf = verbessere(aktuell, regel, puffer, profitabel, jetzt, zufall);
  aktuell = kauf.spielstand;
  aktionen.push(...kauf.aktionen);

  return { spielstand: aktuell, aktionen };
}

/** Deckt die dringendste Unterdeckung – durch Kauf, neue Wache oder Stellplatz-Ausbau. */
function verbessere(spielstand: Spielstand, regel: ZielRegel, puffer: number, profitabel: boolean, jetzt: number, zufall: Zufall): BotSchrittErgebnis {
  // Kein Geld-Spielraum über dem Puffer? Dann nichts kaufen (schützt vor dem Minus).
  if (spielstand.balance <= puffer) return { spielstand, aktionen: [] };

  const fehlende = new Map<BedarfsKlasse, number>();
  for (const incident of spielstand.incidents.filter(istOffen)) {
    const vorschlag = erstelleAlarmVorschlag(incident, { incidents: spielstand.incidents, vehicles: spielstand.vehicles, locations: spielstand.locations });
    for (const fehlt of vorschlag.nichtVerfuegbar) fehlende.set(fehlt.category, (fehlende.get(fehlt.category) ?? 0) + fehlt.anzahl);
  }
  if (fehlende.size === 0) return { spielstand, aktionen: [] };

  const [klasse] = [...fehlende.entries()].sort((a, b) => b[1] - a[1])[0];
  const typ = kaufTypFuer(klasse);
  if (!typ) return { spielstand, aktionen: [] };

  const stationen = spielstand.locations.filter((location) => location.type === 'station');
  const anzahlWachen = stationen.length;

  // Zusätzliche Fahrzeuge (über ein kleines Grundaufgebot hinaus) nur kaufen, wenn es sich rechnet –
  // sonst fressen die Gehälter die Einnahmen auf.
  const grundaufgebot = spielstand.vehicles.length < 2;
  if (!grundaufgebot && !profitabel) return { spielstand, aktionen: [] };

  // Passende Wache mit freiem Stellplatz? Fahrzeug kaufen (nur mit Puffer).
  const mitPlatz = stationen.find((s) => (s.stationKind ?? 'Rettungswache') === typ.wachenArt && hatFreienStellplatz(s, spielstand.vehicles));
  if (mitPlatz) {
    if (spielstand.balance - typ.preis < puffer) return { spielstand, aktionen: [] };
    return kaufeFahrzeug(spielstand, mitPlatz, typ, jetzt, zufall);
  }

  // Keine passende Wache? Nur bauen, wenn erlaubt UND es sich rechnet.
  const passendeWache = stationen.find((s) => (s.stationKind ?? 'Rettungswache') === typ.wachenArt);
  if (!passendeWache) {
    if (!regel.baut || !profitabel || anzahlWachen >= regel.maxWachen || spielstand.balance <= puffer + 20000) return { spielstand, aktionen: [] };
    const basis = stationen[0];
    const coords: [number, number] = [basis.coords[0] + (zufall() - 0.5) * 0.08, basis.coords[1] + (zufall() - 0.5) * 0.08];
    return baueWache(spielstand, typ.wachenArt, jetzt, zufall, coords);
  }

  // Wache voll → Stellplatz erweitern, wenn bezahlbar (Puffer bleibt erhalten)
  const preis = getStellplatzPreis(passendeWache);
  if (preis !== null && spielstand.balance - preis >= puffer) {
    return {
      spielstand: {
        ...spielstand,
        balance: spielstand.balance - preis,
        transactions: mitTransaktion(spielstand.transactions, `Stellplatz-Erweiterung für ${passendeWache.name}`, preis, jetzt),
        locations: spielstand.locations.map((location) => (location.id === passendeWache.id ? mitStellplatzErweiterung(location) : location)),
      },
      aktionen: [{ jetzt, art: 'ausbau', text: `Stellplatz für ${passendeWache.name} erweitert (${preis} €)` }],
    };
  }

  return { spielstand, aktionen: [] };
}

// ---------------------------------------------------------------------------
// Chaos-Ziel: absichtlich Unsinn, soll nie abstürzen (siehe auch chaos.ts)
// ---------------------------------------------------------------------------
function chaosSchritt(spielstand: Spielstand, jetzt: number, zufall: Zufall): BotSchrittErgebnis {
  const aktionen: BotAktion[] = [];
  const wuerfel = zufallsZahl(zufall, 0, 3);

  if (wuerfel === 0) {
    const incident = zufallsElement(zufall, spielstand.incidents);
    const vehicleIds = [zufallsElement(zufall, spielstand.vehicles)?.id ?? 'gibt-es-nicht', 'erfundene-id'];
    if (incident) {
      const ergebnis = alarmiereFahrzeuge({ incidents: spielstand.incidents, vehicles: spielstand.vehicles, locations: spielstand.locations }, incident.id, vehicleIds, jetzt);
      aktionen.push({ jetzt, art: 'chaos', text: `Chaos: wahllose Alarmierung zu ${incident.id}` });
      return { spielstand: { ...spielstand, incidents: ergebnis.incidents, vehicles: ergebnis.vehicles }, aktionen };
    }
  } else if (wuerfel === 1) {
    const incident = zufallsElement(zufall, spielstand.incidents.filter(istOffen));
    const vehicle = zufallsElement(zufall, spielstand.vehicles);
    if (incident && vehicle) {
      const ergebnis = alarmiereFahrzeuge({ incidents: spielstand.incidents, vehicles: spielstand.vehicles, locations: spielstand.locations }, incident.id, [vehicle.id, vehicle.id, vehicle.id], jetzt);
      aktionen.push({ jetzt, art: 'chaos', text: `Chaos: ${vehicle.callsign ?? vehicle.id} mehrfach alarmiert` });
      return { spielstand: { ...spielstand, incidents: ergebnis.incidents, vehicles: ergebnis.vehicles }, aktionen };
    }
  }

  aktionen.push({ jetzt, art: 'chaos', text: 'Chaos: Einsätze absichtlich ignoriert' });
  return { spielstand, aktionen };
}
