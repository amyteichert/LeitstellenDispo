// Balancing-Simulation: Ein „vernünftiger“ Spieler spielt automatisch mit der echten Spiellogik aus shared.
// Aufruf (im Hauptordner, nach `npm run build --workspace=shared`):
//   node scripts/simulation.mjs [Stunden] [Einsatztempo]      z. B. node scripts/simulation.mjs 6 1
//
// Strategie des simulierten Spielers:
// - startet mit Rettungswache + RTW
// - alarmiert jeden Einsatz mit dem Alarmvorschlag (was gerade frei ist) und alarmiert nach
// - spart auf weitere Rettungswachen (mit RTW) bis 5 Wachen, danach kauft er RTW/NEF für freie Stellplätze
// - Personal: Startfahrzeuge haben Besatzung; gekaufte Fahrzeuge kosten zusätzlich Einstellungskosten
import {
  START_GUTHABEN,
  alarmiereFahrzeuge,
  berechneSpielTick,
  einsatzIntervallMs,
  entstehtEinsatz,
  erstelleAlarmVorschlag,
  erzeugeZufallsEinsatz,
  getFahrzeugTyp,
  getStellplaetze,
  getWachenPreis,
  maxOffeneEinsaetze,
  rechneEinsaetzeAb,
  RUF_CONFIG,
} from '../shared/dist/index.js';

const STUNDEN = Number(process.argv[2] ?? 6);
const TEMPO = Number(process.argv[3] ?? 1);
const SCHRITT_MS = 2000;
const T0 = Date.UTC(2026, 5, 10, 8, 0, 0); // Mittwoch, 10 Uhr deutscher Zeit
/** Grobe Einstellungskosten der Besatzung eines gekauften Fahrzeugs (Bewerber mit passender Qualifikation) */
const BESATZUNG_KOSTEN = { RTW: 3000 + 1500, NEF: 5500 + 1500 };

let jetzt = T0;
let balance = START_GUTHABEN;
let ruf = RUF_CONFIG.start;
let locations = [];
let vehicles = [];
let incidents = [];
let einnahmen = 0;
let abgeschlossenGesamt = 0;
const meilensteine = [];

const wache = (nr) => ({
  id: `w${nr}`,
  name: `Rettungswache ${nr}`,
  type: 'station',
  stationKind: 'Rettungswache',
  // Wachen im Abstand von ca. 3–4 km rund um die erste
  coords: [48.775 + Math.cos(nr * 1.7) * 0.03 * Math.min(nr, 1), 9.18 + Math.sin(nr * 1.7) * 0.045 * Math.min(nr, 1)],
  details: '',
  adresse: { strasse: 'Wachenweg', hausnummer: String(nr), plz: '70173', ort: 'Stuttgart' },
});
const fahrzeug = (typ, stationId) => ({
  id: `${typ}-${vehicles.length + 1}`,
  name: typ,
  type: typ,
  stationId,
  price: getFahrzeugTyp(typ).preis,
  callsign: `${typ}-${vehicles.length + 1}`,
  status: 'Einsatzbereit',
});

const baueWache = () => {
  const preis = getWachenPreis('Rettungswache', locations.length) + getFahrzeugTyp('RTW').preis;
  if (balance < preis) return false;
  const w = wache(locations.length + 1);
  locations = [...locations, w];
  vehicles = [...vehicles, fahrzeug('RTW', w.id)];
  balance -= preis;
  meilensteine.push({ zeit: jetzt, text: `${locations.length}. Wache gebaut` });
  return true;
};

const kaufeFahrzeug = (typ) => {
  const preis = getFahrzeugTyp(typ).preis + BESATZUNG_KOSTEN[typ];
  if (balance < preis) return false;
  const w = locations.find((l) => vehicles.filter((v) => v.stationId === l.id).length < getStellplaetze(l));
  if (!w) return false;
  vehicles = [...vehicles, fahrzeug(typ, w.id)];
  balance -= preis;
  meilensteine.push({ zeit: jetzt, text: `${typ} gekauft (${vehicles.length} Fahrzeuge)` });
  return true;
};

const deutscheStunde = (zeit) => (new Date(zeit).getUTCHours() + 2) % 24;

baueWache();
const ende = T0 + STUNDEN * 3600_000;
let letzteSpawnPruefung = jetzt;

while (jetzt < ende) {
  jetzt += SCHRITT_MS;

  // Neue Einsätze (wie im Spiel: Zufall mit Durchschnittsabstand, begrenzte Zahl offener Einsätze)
  const kontext = { stunde: deutscheStunde(jetzt), wochentag: 3, wachen: locations.length, wetter: 'klar' };
  const offene = incidents.filter((e) => e.status !== 'abgeschlossen').length;
  if (offene < maxOffeneEinsaetze(locations.length)
    && entstehtEinsatz(jetzt - letzteSpawnPruefung, einsatzIntervallMs(kontext) / TEMPO)) {
    const ergebnis = erzeugeZufallsEinsatz(locations, vehicles, jetzt, kontext, []);
    if ('einsatz' in ergebnis) incidents = [ergebnis.einsatz, ...incidents];
  }
  letzteSpawnPruefung = jetzt;

  // Alarmieren wie ein echter Spieler: schicken, was frei ist – und nachalarmieren, sobald mehr frei wird
  // Älteste Einsätze zuerst, damit keiner liegen bleibt
  const zuAlarmieren = incidents.filter((e) => e.status === 'offen' || e.status === 'alarmiert').sort((a, b) => a.createdAt - b.createdAt);
  for (const einsatz of zuAlarmieren) {
    const vorschlag = erstelleAlarmVorschlag(einsatz, { incidents, vehicles, locations });
    if (vorschlag.fahrzeugIds.length > 0) {
      ({ incidents, vehicles } = alarmiereFahrzeuge({ incidents, vehicles, locations }, einsatz.id, vorschlag.fahrzeugIds, jetzt));
    }
  }

  // Spielablauf
  const tick = berechneSpielTick({ vehicles, incidents, locations, krankenhaeuser: [] }, jetzt);
  vehicles = tick.vehicles;
  incidents = tick.incidents;
  if (tick.abgeschlossen.length > 0) {
    const abrechnung = rechneEinsaetzeAb(tick.abgeschlossen, ruf);
    ruf = abrechnung.ruf;
    for (const e of abrechnung.einsaetze) {
      const betrag = e.reward + (e.bewertung?.bonus ?? 0);
      balance += betrag;
      einnahmen += betrag;
      abgeschlossenGesamt += 1;
    }
  }

  // Einkaufen
  if (locations.length < 5) baueWache();
  else if (vehicles.filter((v) => v.type === 'NEF').length < locations.length / 2) kaufeFahrzeug('NEF');
  else kaufeFahrzeug('RTW');
}

const min = (zeit) => `${Math.floor((zeit - T0) / 3600_000)}:${String(Math.floor(((zeit - T0) % 3600_000) / 60_000)).padStart(2, '0')} h`;
console.log(`\nSimulation: ${STUNDEN} Stunden, Einsatztempo ${TEMPO}\n`);
for (const m of meilensteine) console.log(`  ${min(m.zeit).padStart(8)}  ${m.text}`);
console.log(`\n  Einsätze abgeschlossen: ${abgeschlossenGesamt} (${(abgeschlossenGesamt / STUNDEN).toFixed(1)} pro Stunde)`);
console.log(`  Einnahmen gesamt:       ${Math.round(einnahmen).toLocaleString('de-DE')} € (${Math.round(einnahmen / STUNDEN).toLocaleString('de-DE')} € pro Stunde)`);
console.log(`  Guthaben am Ende:       ${Math.round(balance).toLocaleString('de-DE')} €`);
console.log(`  Ruf am Ende:            ${ruf}`);
console.log(`  Wachen / Fahrzeuge:     ${locations.length} / ${vehicles.length}\n`);
