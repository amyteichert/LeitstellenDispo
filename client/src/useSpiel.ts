import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GAME_CONFIG,
  RUF_CONFIG,
  WACHEN_PREISE,
  rechneEinsaetzeAb,
  getBelegteStellplaetze,
  getStellplaetze,
  getStellplatzPreis,
  hatFreienStellplatz,
  mitStellplatzErweiterung,
  besetzeAutomatisch,
  erzeugeBesatzungFuer,
  getPersonalDerWache,
  getPersonalLimit,
  getRuheraumPreis,
  kannUmbesetzen,
  mitRuheraumAusbau,
  synchronisiereBesatzung,
  QUALIFIKATION_LABELS,
  getNaechsterRaumPreis,
  getRaumUpgradePreis,
  hatAusbildungsbereich,
  istInAusbildung,
  mitNeuemRaum,
  mitRaumUpgrade,
  schliesseLehrgaengeAb,
  starteLehrgang,
  ZUFRIEDENHEITS_AUSBAUTEN,
  erzeugeAlarmDurchsage,
  erzeugeMeldungsFunk,
  erzeugeStatusFunk,
  fuegeFunkHinzu,
  getMeldungKey,
  getStatusStand,
  quittiereSprechwunsch,
  type FunkSpruch,
  erhoeheStress,
  getZufriedenheitsAusbauPreis,
  mitZufriedenheitsAusbau,
  pruefeKuendigungen,
  type Kuendigung,
  type ZufriedenheitsAusbau,
  type AbgeschlossenerLehrgang,
  type Bewerber,
  type Mitarbeiter,
  type Qualifikation,
  alarmiereFahrzeuge,
  berechneSpielTick,
  createNeuesSpiel,
  erzeugeZufallsEinsatz,
  hatEigenesKrankenhaus,
  EIGENES_KRANKENHAUS,
  FACHRICHTUNGEN,
  getBetten,
  getFachrichtungen,
  pruefeBettenAusbau,
  pruefeFachrichtung,
  pruefeKrankenhausBau,
  type Fachrichtung,
  deutscheZeit,
  einsatzIntervallMs,
  entstehtEinsatz,
  maxOffeneEinsaetze,
  type AufkommenKontext,
  type Wetter,
  formatEinsatzTitel,
  getFahrzeugTyp,
  type AbgeschlossenerSpielEinsatz,
  type Adresse,
  type Krankenhaus,
  type SpielEinsatz,
  type StationKind,
} from '@leitstellendispo/shared';
import type { FinanceTransaction, MapLocation, Vehicle } from './types';
import { SPIELSTAND_VERSION, spielstandSpeicher, type Spielstand } from './spielstand';

export interface NeueWache {
  name: string;
  stationKind: StationKind;
  coords: [number, number];
  details: string;
  startFahrzeugTyp: string;
  funkrufname: string;
  /** Strukturierte Adresse aus der Adresssuche (fehlt bei Klick auf die Karte) */
  adresse?: Adresse;
}

interface UseSpielOptionen {
  /** Wird aufgerufen, nachdem ein Spielstand geladen oder ein neues Spiel gestartet wurde */
  onSpielstandAngewendet?: (spielstand: Spielstand) => void;
  /** Wird aufgerufen, wenn Einsätze abgeschlossen wurden */
  onEinsaetzeAbgeschlossen?: (einsatzIds: string[]) => void;
  /** Aktuelles Wetter am Ort der ersten Wache (beeinflusst das Einsatzaufkommen) */
  wetter?: Wetter;
  /** Wird aufgerufen, wenn nie alarmierte Einsätze nach langer Zeit verschwunden sind */
  onEinsaetzeVerfallen?: (einsatzIds: string[]) => void;
}

/**
 * Spielzustand und Spielablauf (Laden/Speichern, Zeit, Einsatzerzeugung, Spiel-Tick) samt Aktionen.
 * Die eigentliche Logik steckt in reinen Funktionen in `@leitstellendispo/shared` (später auch auf dem Server nutzbar).
 */
export function useSpiel(optionen: UseSpielOptionen = {}) {
  const optionenRef = useRef(optionen);
  optionenRef.current = optionen;

  const [startSpiel] = useState(createNeuesSpiel);
  const [locations, setLocations] = useState<MapLocation[]>(startSpiel.locations);
  const [vehicles, setVehicles] = useState<Vehicle[]>(startSpiel.vehicles);
  const [balance, setBalance] = useState<number>(startSpiel.balance);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(startSpiel.transactions);
  const [incidents, setIncidents] = useState<SpielEinsatz[]>(startSpiel.incidents);
  const [completedIncidentHistory, setCompletedIncidentHistory] = useState<AbgeschlossenerSpielEinsatz[]>(startSpiel.completedIncidentHistory);
  const [krankenhaeuser, setKrankenhaeuser] = useState<Krankenhaus[]>(startSpiel.krankenhaeuser);
  const [ruf, setRuf] = useState<number>(startSpiel.ruf ?? RUF_CONFIG.start);
  const [personal, setPersonal] = useState<Mitarbeiter[]>(startSpiel.personal ?? []);
  // Für die Abrechnung im Tick immer den aktuellsten Ruf verwenden
  const rufRef = useRef(ruf);
  rufRef.current = ruf;
  const [nowMs, setNowMs] = useState(Date.now());
  // Erst nach dem Laden wird gespeichert und werden Einsätze erzeugt (sonst würde ein leerer Stand den gespeicherten überschreiben)
  const [spielstandGeladen, setSpielstandGeladen] = useState(false);
  // Laden fehlgeschlagen (z. B. Server weg): Dann wird auch nichts gespeichert, damit der echte Stand erhalten bleibt
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);

  const addTransaction = (kind: FinanceTransaction['kind'], label: string, amount: number) => {
    setTransactions((cur) => [{
      id: `txn-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind,
      label,
      amount,
      createdAt: new Date().toISOString(),
    }, ...cur]);
  };

  /** Legt ein Fahrzeug an. Die Besatzung ergibt sich aus dem zugewiesenen Personal (neu = leer). */
  const addVehicle = (v: Omit<Vehicle, 'id'>): Vehicle => {
    const id = `fahrzeug-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const fahrzeug: Vehicle = { ...v, id, status: v.status ?? 'Einsatzbereit' };
    setVehicles((cur) => [...cur, fahrzeug]);
    return fahrzeug;
  };

  // Fällige Lehrgänge abschließen (auch solche, die während das Spiel geschlossen war, geendet haben)
  const [ausbildungsAbschluesse, setAusbildungsAbschluesse] = useState<AbgeschlossenerLehrgang[]>([]);
  useEffect(() => {
    const ergebnis = schliesseLehrgaengeAb(locations, personal, nowMs);
    if (ergebnis.abgeschlossen.length === 0) return;
    setLocations(ergebnis.locations);
    setPersonal(ergebnis.personal);
    setAusbildungsAbschluesse((current) => [...ergebnis.abgeschlossen, ...current].slice(0, 10));
  }, [locations, personal, nowMs]);

  // Stündlich: Kündigt jemand wegen niedriger Zufriedenheit? (nur unter 40 %)
  const [kuendigungen, setKuendigungen] = useState<Kuendigung[]>([]);
  useEffect(() => {
    if (!spielstandGeladen) return;
    const unterwegs = (fahrzeugId: string) => {
      const fahrzeug = vehicles.find((vehicle) => vehicle.id === fahrzeugId);
      return fahrzeug ? !kannUmbesetzen(fahrzeug) : false;
    };
    const ergebnis = pruefeKuendigungen(locations, personal, unterwegs, nowMs);
    if (ergebnis.locations !== locations) setLocations(ergebnis.locations);
    if (ergebnis.personal !== personal) setPersonal(ergebnis.personal);
    if (ergebnis.kuendigungen.length > 0) setKuendigungen((current) => [...ergebnis.kuendigungen, ...current].slice(0, 20));
  }, [spielstandGeladen, locations, personal, vehicles, nowMs]);

  // ---- Funkverkehr: Statuswechsel und neue Lagemeldungen erkennen ----
  const [funk, setFunk] = useState<FunkSpruch[]>(startSpiel.funk ?? []);
  const statusStand = useRef<Map<string, number> | null>(null);
  const bekannteMeldungen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!spielstandGeladen) return;
    const stand = getStatusStand(vehicles);
    // Erster Durchlauf nach dem Laden: nur merken, nicht funken
    if (statusStand.current) {
      const neue = erzeugeStatusFunk(statusStand.current, vehicles, Date.now());
      if (neue.length > 0) setFunk((current) => fuegeFunkHinzu(current, neue));
    }
    statusStand.current = stand;
  }, [spielstandGeladen, vehicles]);

  useEffect(() => {
    if (!spielstandGeladen) return;
    // Abgeschlossene Einsätze mitprüfen – ihre letzte Meldung (z. B. Übergabe) kommt im selben Schritt wie der Abschluss
    const einsaetze = [...incidents, ...completedIncidentHistory.slice(0, 10)];
    const alle = einsaetze.flatMap((einsatz) => einsatz.meldungen.map((meldung) => ({ einsatz, meldung, key: getMeldungKey(einsatz.id, meldung) })));
    if (bekannteMeldungen.current) {
      const neue = alle
        .filter(({ key }) => !bekannteMeldungen.current!.has(key))
        .map(({ einsatz, meldung }) => erzeugeMeldungsFunk(einsatz, meldung, vehicles));
      if (neue.length > 0) setFunk((current) => fuegeFunkHinzu(current, neue));
      alle.forEach(({ key }) => bekannteMeldungen.current!.add(key));
    } else {
      bekannteMeldungen.current = new Set(alle.map(({ key }) => key));
    }
  }, [spielstandGeladen, incidents, completedIncidentHistory]);

  /** Sprechaufforderung an ein Fahrzeug mit Sprechwunsch (Status 5). */
  const gibSprechaufforderung = (sprechwunschId: string) => {
    setFunk((current) => quittiereSprechwunsch(current, sprechwunschId, Date.now()));
  };

  // Besatzung der Fahrzeuge immer aus dem Personal ableiten
  useEffect(() => {
    setVehicles((current) => synchronisiereBesatzung(current, personal));
  }, [personal, vehicles]);

  const spielstandAnwenden = (spielstand: Spielstand) => {
    setBalance(spielstand.balance);
    setTransactions(spielstand.transactions);
    setLocations(spielstand.locations);
    setVehicles(spielstand.vehicles);
    setIncidents(spielstand.incidents);
    setCompletedIncidentHistory(spielstand.completedIncidentHistory);
    setKrankenhaeuser(spielstand.krankenhaeuser);
    setRuf(spielstand.ruf ?? RUF_CONFIG.start);
    setPersonal(spielstand.personal ?? []);
    setFunk(spielstand.funk ?? []);
    // Nach dem Laden neu einlesen, ohne alte Meldungen und Status nochmal zu funken
    statusStand.current = null;
    bekannteMeldungen.current = null;
    optionenRef.current.onSpielstandAngewendet?.(spielstand);
  };

  // Spielstand beim Start laden
  useEffect(() => {
    let abgebrochen = false;
    spielstandSpeicher.laden().then(
      (spielstand) => {
        if (abgebrochen) return;
        if (spielstand) spielstandAnwenden(spielstand);
        setSpielstandGeladen(true);
      },
      (error: unknown) => {
        if (abgebrochen) return;
        console.error(error);
        setLadeFehler('Dein Spielstand konnte nicht geladen werden. Bitte prüfe, ob der Server läuft, und lade die Seite neu.');
      },
    );
    return () => {
      abgebrochen = true;
    };
  }, []);

  // Spielstand automatisch speichern (kurz verzögert, damit nicht bei jeder Kleinigkeit geschrieben wird)
  useEffect(() => {
    if (!spielstandGeladen) return;
    const timeout = setTimeout(() => {
      spielstandSpeicher.speichern({
        version: SPIELSTAND_VERSION,
        gespeichertAm: new Date().toISOString(),
        balance,
        transactions,
        locations,
        vehicles,
        incidents,
        completedIncidentHistory,
        krankenhaeuser,
        ruf,
        personal,
        funk,
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [spielstandGeladen, balance, transactions, locations, vehicles, incidents, completedIncidentHistory, krankenhaeuser, ruf, personal, funk]);

  // Spielzeit
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Neue Einsätze in regelmäßigen Abständen
  // Neue Einsätze: Häufigkeit und Art nach deutscher Uhrzeit, Wochentag, Wachenzahl und Wetter.
  // Eigener Sekundentakt mit Refs – sonst würde jede Fahrzeugbewegung den Takt neu starten.
  const eigenesKrankenhaus = hatEigenesKrankenhaus(krankenhaeuser);
  const erzeugungRef = useRef({ locations, vehicles, wetter: 'klar' as Wetter, krankenhaeuser });
  erzeugungRef.current = { locations, vehicles, wetter: optionen.wetter ?? 'klar', krankenhaeuser };
  useEffect(() => {
    if (!spielstandGeladen) return;
    let zuletzt = Date.now();
    const interval = setInterval(() => {
      const jetzt = Date.now();
      const vergangen = jetzt - zuletzt;
      zuletzt = jetzt;
      const { locations: orte, vehicles: fahrzeuge, wetter, krankenhaeuser: kliniken } = erzeugungRef.current;
      const wachen = orte.filter((location) => location.type === 'station').length;
      if (wachen === 0) return;
      const kontext: AufkommenKontext = { ...deutscheZeit(jetzt), wachen, wetter };
      if (!entstehtEinsatz(Math.min(vergangen, 5000), einsatzIntervallMs(kontext))) return;
      setIncidents((current) => {
        if (current.filter((incident) => incident.status !== 'abgeschlossen').length >= maxOffeneEinsaetze(wachen)) return current;
        const ergebnis = erzeugeZufallsEinsatz(orte, fahrzeuge, jetzt, kontext, kliniken);
        return 'einsatz' in ergebnis ? [ergebnis.einsatz, ...current] : current;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [spielstandGeladen]);

  // Spiel-Tick: Ankunft, Lagemeldungen, Bearbeitung, Eskalation, Transport, Abschluss, Rückfahrt
  useEffect(() => {
    const ergebnis = berechneSpielTick({ vehicles, incidents, locations, krankenhaeuser }, nowMs);
    if (!ergebnis.geaendert) return;

    setVehicles(ergebnis.vehicles);
    setIncidents(ergebnis.incidents);
    if (ergebnis.krankenhaeuser) setKrankenhaeuser(ergebnis.krankenhaeuser);

    if (ergebnis.abgeschlossen.length > 0) {
      // Grundgeld gibt es immer, dazu ein Leistungsbonus abhängig von Anfahrt und Ruf
      const abrechnung = rechneEinsaetzeAb(ergebnis.abgeschlossen, rufRef.current);
      rufRef.current = abrechnung.ruf;
      setRuf(abrechnung.ruf);
      setCompletedIncidentHistory((current) => [
        ...[...abrechnung.einsaetze].reverse(),
        ...current,
      ].slice(0, GAME_CONFIG.completedIncidentHistoryLimit));
      const summe = abrechnung.einsaetze.reduce((sum, incident) => sum + incident.reward + (incident.bewertung?.bonus ?? 0), 0);
      setBalance((cur) => cur + summe);
      abrechnung.einsaetze.forEach((incident) => {
        addTransaction('Einnahme', `${incident.organization} – ${formatEinsatzTitel(incident)} abgeschlossen`, incident.reward);
        if (incident.bewertung && incident.bewertung.bonus > 0) {
          addTransaction('Einnahme', `Leistungsbonus – ${formatEinsatzTitel(incident)}`, incident.bewertung.bonus);
        }
      });
      optionenRef.current.onEinsaetzeAbgeschlossen?.(ergebnis.abgeschlossen.map((incident) => incident.id));
    }
    if (ergebnis.verfallen.length > 0) {
      optionenRef.current.onEinsaetzeVerfallen?.(ergebnis.verfallen.map((incident) => incident.id));
    }
  }, [incidents, vehicles, nowMs, locations, krankenhaeuser]);

  const completedIncidentStats = useMemo(() => {
    const total = completedIncidentHistory.length;
    const rettungsdienst = completedIncidentHistory.filter((incident) => incident.organization === 'Rettungsdienst').length;
    const feuerwehr = completedIncidentHistory.filter((incident) => incident.organization === 'Feuerwehr').length;
    const earned = completedIncidentHistory.reduce((sum, incident) => sum + incident.reward + (incident.bewertung?.bonus ?? 0), 0);
    return { total, rettungsdienst, feuerwehr, earned };
  }, [completedIncidentHistory]);

  // ---- Aktionen ----

  /** Funkrufname nach Schema „LF10-2“ (fortlaufend je Fahrzeugtyp) */
  const naechsterFunkrufname = (typ: string) => `${typ.replace(/\s+/g, '')}-${vehicles.filter((vehicle) => vehicle.type === typ).length + 1}`;

  /** Kauft ein Fahrzeug für eine Wache. Gibt eine Fehlermeldung zurück oder null bei Erfolg. */
  const buyVehicle = (stationId: string, typ: string): string | null => {
    const station = locations.find((location) => location.id === stationId && location.type === 'station');
    const fahrzeugTyp = getFahrzeugTyp(typ);
    if (!station || !fahrzeugTyp) return 'Wache oder Fahrzeugtyp nicht gefunden.';
    if (fahrzeugTyp.wachenArt !== (station.stationKind ?? 'Rettungswache')) {
      return `${typ} passt nicht zu einer ${station.stationKind ?? 'Rettungswache'}.`;
    }
    if (fahrzeugTyp.brauchtEigenesKrankenhaus && !eigenesKrankenhaus) {
      return `Den ${typ} gibt es erst, wenn du ein eigenes Krankenhaus gebaut hast.`;
    }
    if (!hatFreienStellplatz(station, vehicles)) {
      return `Kein freier Stellplatz (${getBelegteStellplaetze(station.id, vehicles)} von ${getStellplaetze(station)} belegt). Erweitere die Wache unter „Ausbau“.`;
    }
    if (balance < fahrzeugTyp.preis) {
      return `Nicht genügend Guthaben. Benötigt: ${fahrzeugTyp.preis} €, verfügbar: ${balance} €.`;
    }

    setBalance((cur) => cur - fahrzeugTyp.preis);
    addTransaction('Ausgabe', `${typ} für ${station.name} gekauft`, fahrzeugTyp.preis);
    addVehicle({
      name: typ,
      type: typ,
      stationId,
      price: fahrzeugTyp.preis,
      callsign: naechsterFunkrufname(typ),
    });
    return null;
  };

  /** Baut eine neue Wache mit Startfahrzeug. Gibt die neue Wachen-ID oder eine Fehlermeldung zurück. */
  /** Eigenes Krankenhaus bauen (Voraussetzungen: Wachen, Ruf, Geld) */
  const baueKrankenhaus = (name: string, coords: [number, number], adresse?: Adresse): string | null => {
    const wachen = locations.filter((location) => location.type === 'station').length;
    const grund = pruefeKrankenhausBau(wachen, ruf, balance);
    if (grund) return grund;
    const ort = adresse ?? { strasse: 'Klinikstraße', plz: '', ort: name };
    setKrankenhaeuser((current) => [...current, {
      id: `kh-eigen-${Date.now()}`,
      name: name.trim() || 'Eigenes Krankenhaus',
      adresse: ort,
      coords,
      aufnahme: true,
      eigen: true,
      fachbereiche: ['innere'],
      kapazitaet: EIGENES_KRANKENHAUS.startBetten,
      aufnahmen: [],
    }]);
    setBalance((cur) => cur - EIGENES_KRANKENHAUS.preis);
    addTransaction('Ausgabe', `Krankenhaus gebaut: ${name}`, EIGENES_KRANKENHAUS.preis);
    return null;
  };

  const schalteFachrichtungFrei = (krankenhausId: string, fachrichtung: Fachrichtung): string | null => {
    const krankenhaus = krankenhaeuser.find((kh) => kh.id === krankenhausId && kh.eigen);
    if (!krankenhaus) return 'Krankenhaus nicht gefunden.';
    const grund = pruefeFachrichtung(krankenhaus, fachrichtung, ruf, balance);
    if (grund) return grund;
    const preis = FACHRICHTUNGEN[fachrichtung].preis;
    setKrankenhaeuser((current) => current.map((kh) => (kh.id === krankenhausId ? { ...kh, fachbereiche: [...getFachrichtungen(kh), fachrichtung] } : kh)));
    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `${krankenhaus.name}: ${FACHRICHTUNGEN[fachrichtung].label}`, preis);
    return null;
  };

  const baueBettenAus = (krankenhausId: string): string | null => {
    const krankenhaus = krankenhaeuser.find((kh) => kh.id === krankenhausId && kh.eigen);
    if (!krankenhaus) return 'Krankenhaus nicht gefunden.';
    const grund = pruefeBettenAusbau(krankenhaus, balance);
    if (grund) return grund;
    setKrankenhaeuser((current) => current.map((kh) => (kh.id === krankenhausId ? { ...kh, kapazitaet: getBetten(kh) + EIGENES_KRANKENHAUS.bettenJeAusbau } : kh)));
    setBalance((cur) => cur - EIGENES_KRANKENHAUS.bettenAusbauPreis);
    addTransaction('Ausgabe', `${krankenhaus.name}: +${EIGENES_KRANKENHAUS.bettenJeAusbau} Betten`, EIGENES_KRANKENHAUS.bettenAusbauPreis);
    return null;
  };

  const erstelleWache = (wache: NeueWache): { id: string } | { fehler: string } => {
    const stationPrice = WACHEN_PREISE[wache.stationKind] ?? 0;
    const vehiclePrice = getFahrzeugTyp(wache.startFahrzeugTyp)?.preis ?? 0;
    const totalCost = stationPrice + vehiclePrice;

    if (balance < totalCost) {
      return { fehler: `Nicht genügend Guthaben für die Erstellung. Benötigt: ${totalCost} €, verfügbar: ${balance} €.` };
    }

    const name = wache.name.trim() || 'Neuer Standort';
    const locationId = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const neueWache: MapLocation = {
      id: locationId,
      name,
      type: 'station',
      stationKind: wache.stationKind,
      coords: wache.coords,
      description: wache.stationKind === 'Feuerwache' ? 'Feuerwehr' : 'Rettungsdienst',
      details: wache.details.trim() || `Frei platzierbare ${wache.stationKind}`,
      price: stationPrice,
      adresse: wache.adresse,
    };
    setLocations((current) => [...current, neueWache]);
    // Patienten brauchen ein Krankenhaus in erreichbarer Nähe
    setBalance((cur) => cur - totalCost);
    addTransaction('Ausgabe', `${wache.stationKind} mit ${wache.startFahrzeugTyp} erstellt`, totalCost);

    if (wache.startFahrzeugTyp) {
      const startFahrzeug = addVehicle({
        name: wache.startFahrzeugTyp,
        type: wache.startFahrzeugTyp,
        stationId: locationId,
        price: vehiclePrice,
        callsign: wache.funkrufname.trim() || naechsterFunkrufname(wache.startFahrzeugTyp),
      });
      // Das Startfahrzeug kommt mit voller Besatzung
      setPersonal((current) => [...current, ...erzeugeBesatzungFuer(startFahrzeug)]);
    }

    return { id: locationId };
  };

  /** Baut einen zusätzlichen Stellplatz. Gibt eine Fehlermeldung zurück oder null bei Erfolg. */
  const erweitereStellplaetze = (stationId: string): string | null => {
    const station = locations.find((location) => location.id === stationId && location.type === 'station');
    if (!station) return 'Wache nicht gefunden.';
    const preis = getStellplatzPreis(station);
    if (preis === null) return 'Die Wache ist bereits voll ausgebaut.';
    if (balance < preis) return `Nicht genügend Guthaben. Benötigt: ${preis.toLocaleString('de-DE')} €, verfügbar: ${balance.toLocaleString('de-DE')} €.`;

    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `Stellplatz-Erweiterung für ${station.name}`, preis);
    setLocations((current) => current.map((location) => (location.id === stationId ? mitStellplatzErweiterung(location) : location)));
    return null;
  };

  const loescheWache = (id: string) => {
    setLocations((current) => current.filter((location) => location.id !== id));
    setPersonal((current) => current.filter((person) => person.wacheId !== id));
  };

  // ---- Personal ----

  const findeWache = (wacheId: string) => locations.find((location) => location.id === wacheId && location.type === 'station');

  /** Stellt einen Bewerber ein. Gibt eine Fehlermeldung zurück oder null bei Erfolg. */
  const stellePersonalEin = (wacheId: string, bewerber: Bewerber): string | null => {
    const wache = findeWache(wacheId);
    if (!wache) return 'Wache nicht gefunden.';
    const limit = getPersonalLimit(wache);
    if (getPersonalDerWache(wacheId, personal).length >= limit) {
      return `Kein Platz mehr für Personal (${limit} von ${limit}). Baue unter „Ausbau“ Ruheräume.`;
    }
    if (balance < bewerber.preis) return `Nicht genügend Guthaben. Benötigt: ${bewerber.preis.toLocaleString('de-DE')} €.`;

    setBalance((cur) => cur - bewerber.preis);
    addTransaction('Ausgabe', `${bewerber.name} für ${wache.name} eingestellt`, bewerber.preis);
    setPersonal((current) => [...current, { id: bewerber.id, name: bewerber.name, qualifikationen: bewerber.qualifikationen, wacheId }]);
    return null;
  };

  const fahrzeugVon = (person: Mitarbeiter | undefined) => vehicles.find((vehicle) => vehicle.id === person?.fahrzeugId);

  /** Entlässt eine Person (keine Erstattung). Nicht möglich, solange ihr Fahrzeug unterwegs ist. */
  const entlassePersonal = (personId: string): string | null => {
    const person = personal.find((eintrag) => eintrag.id === personId);
    if (person && istInAusbildung(person)) return `${person.name} ist auf einem Lehrgang – erst danach möglich.`;
    const fahrzeug = fahrzeugVon(person);
    if (fahrzeug && !kannUmbesetzen(fahrzeug)) return `${fahrzeug.callsign ?? fahrzeug.name} ist unterwegs – erst nach der Rückkehr möglich.`;
    setPersonal((current) => current.filter((person) => person.id !== personId));
    return null;
  };

  /** Weist eine Person einem Fahrzeug ihrer Wache zu (oder ohne `fahrzeugId` in die Reserve). */
  const weisePersonalZu = (personId: string, fahrzeugId?: string): string | null => {
    const person = personal.find((eintrag) => eintrag.id === personId);
    if (!person) return 'Person nicht gefunden.';
    if (istInAusbildung(person)) return `${person.name} ist auf einem Lehrgang.`;
    const bisher = fahrzeugVon(person);
    if (bisher && !kannUmbesetzen(bisher)) return `${bisher.callsign ?? bisher.name} ist unterwegs – erst nach der Rückkehr möglich.`;
    if (fahrzeugId) {
      const ziel = vehicles.find((vehicle) => vehicle.id === fahrzeugId);
      if (!ziel || ziel.stationId !== person.wacheId) return 'Das Fahrzeug gehört nicht zu dieser Wache.';
      if (!kannUmbesetzen(ziel)) return `${ziel.callsign ?? ziel.name} ist unterwegs – erst nach der Rückkehr möglich.`;
      const soll = getFahrzeugTyp(ziel.type)?.besatzung ?? 0;
      if (personal.filter((eintrag) => eintrag.fahrzeugId === fahrzeugId).length >= soll) return `${ziel.callsign ?? ziel.name} ist bereits voll besetzt.`;
    }
    setPersonal((current) => current.map((eintrag) => (eintrag.id === personId ? { ...eintrag, fahrzeugId } : eintrag)));
    return null;
  };

  /** Besetzt ein Fahrzeug mit freiem Personal der Wache (Pflicht-Qualifikation zuerst). */
  const besetzeFahrzeugAutomatisch = (fahrzeugId: string): string | null => {
    const fahrzeug = vehicles.find((vehicle) => vehicle.id === fahrzeugId);
    if (!fahrzeug) return 'Fahrzeug nicht gefunden.';
    if (!kannUmbesetzen(fahrzeug)) return `${fahrzeug.callsign ?? fahrzeug.name} ist unterwegs – erst nach der Rückkehr möglich.`;
    setPersonal((current) => besetzeAutomatisch(fahrzeug, current));
    return null;
  };

  // ---- Ausbildung ----

  /** Baut den Ausbildungsbereich (erster Raum) bzw. einen weiteren Raum. */
  const baueAusbildungsraum = (wacheId: string): string | null => {
    const wache = findeWache(wacheId);
    if (!wache) return 'Wache nicht gefunden.';
    const preis = getNaechsterRaumPreis(wache);
    if (preis === null) return 'Es sind bereits alle Ausbildungsräume gebaut.';
    if (balance < preis) return `Nicht genügend Guthaben. Benötigt: ${preis.toLocaleString('de-DE')} €.`;
    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `${hatAusbildungsbereich(wache) ? 'Ausbildungsraum' : 'Ausbildungsbereich'} für ${wache.name}`, preis);
    setLocations((current) => current.map((location) => (location.id === wacheId ? mitNeuemRaum(location) : location)));
    return null;
  };

  /** Erweitert einen Ausbildungsraum um weitere Plätze. */
  const erweitereAusbildungsraum = (wacheId: string, raumId: string): string | null => {
    const wache = findeWache(wacheId);
    const raum = wache?.ausbildungsRaeume?.find((r) => r.id === raumId);
    if (!wache || !raum) return 'Raum nicht gefunden.';
    const preis = getRaumUpgradePreis(raum);
    if (preis === null) return 'Dieser Raum ist bereits voll ausgebaut.';
    if (balance < preis) return `Nicht genügend Guthaben. Benötigt: ${preis.toLocaleString('de-DE')} €.`;
    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `Ausbildungsraum erweitert (${wache.name})`, preis);
    setLocations((current) => current.map((location) => (location.id === wacheId ? mitRaumUpgrade(location, raumId) : location)));
    return null;
  };

  /** Startet einen Lehrgang. Teilnehmer, deren Fahrzeug unterwegs ist, können nicht teilnehmen. */
  const starteLehrgangAnWache = (wacheId: string, raumId: string, qualifikation: Qualifikation, teilnehmerIds: string[]): string | null => {
    const wache = findeWache(wacheId);
    if (!wache) return 'Wache nicht gefunden.';
    for (const id of teilnehmerIds) {
      const fahrzeug = fahrzeugVon(personal.find((person) => person.id === id));
      if (fahrzeug && !kannUmbesetzen(fahrzeug)) return `${fahrzeug.callsign ?? fahrzeug.name} ist unterwegs – Teilnehmer erst nach der Rückkehr anmelden.`;
    }
    const ergebnis = starteLehrgang({ wache, raumId, qualifikation, teilnehmerIds, personal, jetzt: Date.now() });
    if ('fehler' in ergebnis) return ergebnis.fehler;
    if (balance < ergebnis.kosten) return `Nicht genügend Guthaben. Benötigt: ${ergebnis.kosten.toLocaleString('de-DE')} €.`;
    setBalance((cur) => cur - ergebnis.kosten);
    addTransaction('Ausgabe', `Lehrgang ${QUALIFIKATION_LABELS[qualifikation]} (${teilnehmerIds.length} Teilnehmer)`, ergebnis.kosten);
    setLocations((current) => current.map((location) => (location.id === wacheId ? ergebnis.wache : location)));
    setPersonal(ergebnis.personal);
    return null;
  };

  /** Baut Aufenthaltsraum, Küche oder Fitnessraum aus (höhere Zufriedenheit). */
  const baueZufriedenheitsAusbau = (wacheId: string, ausbauId: ZufriedenheitsAusbau['id']): string | null => {
    const wache = findeWache(wacheId);
    const ausbau = ZUFRIEDENHEITS_AUSBAUTEN.find((eintrag) => eintrag.id === ausbauId);
    if (!wache || !ausbau) return 'Ausbau nicht gefunden.';
    const preis = getZufriedenheitsAusbauPreis(wache, ausbau);
    if (preis === null) return `${ausbau.name} ist bereits voll ausgebaut.`;
    if (balance < preis) return `Nicht genügend Guthaben. Benötigt: ${preis.toLocaleString('de-DE')} €.`;
    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `${ausbau.name} für ${wache.name}`, preis);
    setLocations((current) => current.map((location) => (location.id === wacheId ? mitZufriedenheitsAusbau(location, ausbauId) : location)));
    return null;
  };

  /** Baut eine Ruheraum-Stufe (mehr Personal-Plätze). */
  const baueRuheraum = (wacheId: string): string | null => {
    const wache = findeWache(wacheId);
    if (!wache) return 'Wache nicht gefunden.';
    const preis = getRuheraumPreis(wache);
    if (preis === null) return 'Ruheräume sind bereits voll ausgebaut.';
    if (balance < preis) return `Nicht genügend Guthaben. Benötigt: ${preis.toLocaleString('de-DE')} €.`;
    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `Ruheräume für ${wache.name}`, preis);
    setLocations((current) => current.map((location) => (location.id === wacheId ? mitRuheraumAusbau(location) : location)));
    return null;
  };

  /** Erzeugt sofort einen Test-Einsatz. Gibt die Einsatz-ID oder eine Fehlermeldung zurück. */
  const erzeugeTestEinsatz = (): { id: string } | { fehler: string } => {
    const ergebnis = erzeugeZufallsEinsatz(locations, vehicles, Date.now(), undefined, krankenhaeuser);
    if ('fehler' in ergebnis) {
      return {
        fehler: ergebnis.fehler === 'keine-wache'
          ? 'Bitte erst eine Wache erstellen.'
          : 'Für diese Wache gibt es aktuell keinen Einsatz, den deine Fahrzeuge schaffen können.',
      };
    }
    setIncidents((current) => [ergebnis.einsatz, ...current]);
    return { id: ergebnis.einsatz.id };
  };

  const alarmieren = (incidentId: string, vehicleIds: string[]) => {
    const jetzt = Date.now();
    const ergebnis = alarmiereFahrzeuge({ incidents, vehicles, locations }, incidentId, vehicleIds, jetzt);
    setIncidents(ergebnis.incidents);
    setVehicles(ergebnis.vehicles);
    // Jede tatsächlich alarmierte Besatzung bekommt Stress (Dauerstress senkt die Zufriedenheit)
    const vorher = new Set(incidents.find((incident) => incident.id === incidentId)?.alarmedVehicles.map((a) => a.vehicleId));
    const neu = ergebnis.incidents.find((incident) => incident.id === incidentId)?.alarmedVehicles.filter((a) => !vorher.has(a.vehicleId)) ?? [];
    const wacheIds = neu.map((a) => vehicles.find((vehicle) => vehicle.id === a.vehicleId)?.stationId).filter((id): id is string => Boolean(id));
    setLocations((current) => erhoeheStress(current, wacheIds, jetzt));
    // Alarmdurchsage
    const einsatz = ergebnis.incidents.find((incident) => incident.id === incidentId);
    const alarmierte = neu.map((a) => vehicles.find((vehicle) => vehicle.id === a.vehicleId)).filter((v): v is Vehicle => Boolean(v));
    if (einsatz && alarmierte.length > 0) setFunk((current) => fuegeFunkHinzu(current, [erzeugeAlarmDurchsage(einsatz, alarmierte, jetzt)]));
  };

  const markiereMeldungGelesen = (incidentId: string) => {
    setIncidents((current) => current.map((incident) => (
      incident.id === incidentId ? { ...incident, neueMeldung: false } : incident
    )));
  };

  const neuesSpiel = () => {
    // Den Spielstand sofort durch den neuen ersetzen – nicht löschen: Ein Konto ohne Spielstand würde beim
    // nächsten Laden einen alten Browser-Spielstand übernehmen (dann wären die alten Wachen wieder da).
    const neu = createNeuesSpiel();
    spielstandAnwenden(neu);
    void spielstandSpeicher.speichern(neu).then(() => spielstandSpeicher.sofortSpeichern?.());
  };

  // ---- Dev-Werkzeuge (nur Team, nur eigenes Konto – der Aufrufer setzt vorher die Dev-Markierung) ----

  const devGeld = (betrag: number) => {
    setBalance((cur) => cur + betrag);
    addTransaction(betrag >= 0 ? 'Einnahme' : 'Ausgabe', 'Dev-Werkzeug: Guthaben angepasst', Math.abs(betrag));
  };

  const devRufSetzen = (wert: number) => setRuf(Math.min(RUF_CONFIG.max, Math.max(RUF_CONFIG.min, Math.round(wert))));

  /** Alle laufenden Lehrgänge enden sofort (der nächste Spiel-Tick vergibt die Qualifikationen). */
  const devLehrgaengeBeenden = () => {
    const jetzt = Date.now();
    setLocations((current) => current.map((location) => (location.ausbildungsRaeume?.some((raum) => raum.lehrgang)
      ? {
        ...location,
        ausbildungsRaeume: location.ausbildungsRaeume.map((raum) => (raum.lehrgang ? { ...raum, lehrgang: { ...raum.lehrgang, endeAt: jetzt } } : raum)),
      }
      : location)));
  };

  return {
    spielstandGeladen,
    ladeFehler,
    locations,
    vehicles,
    balance,
    transactions,
    incidents,
    completedIncidentHistory,
    completedIncidentStats,
    krankenhaeuser,
    baueKrankenhaus,
    schalteFachrichtungFrei,
    baueBettenAus,
    ruf,
    nowMs,
    addVehicle,
    buyVehicle,
    eigenesKrankenhaus,
    erstelleWache,
    erweitereStellplaetze,
    loescheWache,
    personal,
    stellePersonalEin,
    entlassePersonal,
    weisePersonalZu,
    besetzeFahrzeugAutomatisch,
    baueRuheraum,
    baueAusbildungsraum,
    erweitereAusbildungsraum,
    starteLehrgangAnWache,
    ausbildungsAbschluesse,
    baueZufriedenheitsAusbau,
    kuendigungen,
    funk,
    gibSprechaufforderung,
    erzeugeTestEinsatz,
    devGeld,
    devRufSetzen,
    devLehrgaengeBeenden,
    alarmieren,
    markiereMeldungGelesen,
    neuesSpiel,
  };
}
