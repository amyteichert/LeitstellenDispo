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
  type AbgeschlossenerLehrgang,
  type Bewerber,
  type Mitarbeiter,
  type Qualifikation,
  alarmiereFahrzeuge,
  berechneSpielTick,
  createNeuesSpiel,
  ergaenzeKrankenhaeuser,
  erzeugeZufallsEinsatz,
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
    optionenRef.current.onSpielstandAngewendet?.(spielstand);
  };

  // Spielstand beim Start laden
  useEffect(() => {
    let abgebrochen = false;
    spielstandSpeicher.laden().then((spielstand) => {
      if (abgebrochen) return;
      if (spielstand) spielstandAnwenden(spielstand);
      setSpielstandGeladen(true);
    });
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
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [spielstandGeladen, balance, transactions, locations, vehicles, incidents, completedIncidentHistory, krankenhaeuser, ruf, personal]);

  // Spielzeit
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Neue Einsätze in regelmäßigen Abständen
  useEffect(() => {
    if (!spielstandGeladen) return;
    if (!locations.some((location) => location.type === 'station')) return;
    if (incidents.filter((incident) => incident.status !== 'abgeschlossen').length >= GAME_CONFIG.maxOpenIncidents) return;

    const interval = setInterval(() => {
      setIncidents((current) => {
        if (current.filter((incident) => incident.status !== 'abgeschlossen').length >= GAME_CONFIG.maxOpenIncidents) {
          return current;
        }
        const ergebnis = erzeugeZufallsEinsatz(locations, vehicles);
        return 'einsatz' in ergebnis ? [ergebnis.einsatz, ...current] : current;
      });
    }, GAME_CONFIG.incidentGenerationMs);

    return () => clearInterval(interval);
  }, [spielstandGeladen, locations, incidents, vehicles]);

  // Spiel-Tick: Ankunft, Lagemeldungen, Bearbeitung, Eskalation, Transport, Abschluss, Rückfahrt
  useEffect(() => {
    const ergebnis = berechneSpielTick({ vehicles, incidents, locations, krankenhaeuser }, nowMs);
    if (!ergebnis.geaendert) return;

    setVehicles(ergebnis.vehicles);
    setIncidents(ergebnis.incidents);

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
    setKrankenhaeuser((current) => ergaenzeKrankenhaeuser(current, neueWache));
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
    const ergebnis = erzeugeZufallsEinsatz(locations, vehicles);
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
    const ergebnis = alarmiereFahrzeuge({ incidents, vehicles, locations }, incidentId, vehicleIds);
    setIncidents(ergebnis.incidents);
    setVehicles(ergebnis.vehicles);
  };

  const markiereMeldungGelesen = (incidentId: string) => {
    setIncidents((current) => current.map((incident) => (
      incident.id === incidentId ? { ...incident, neueMeldung: false } : incident
    )));
  };

  const neuesSpiel = () => {
    spielstandSpeicher.loeschen();
    spielstandAnwenden(createNeuesSpiel());
  };

  return {
    spielstandGeladen,
    locations,
    vehicles,
    balance,
    transactions,
    incidents,
    completedIncidentHistory,
    completedIncidentStats,
    krankenhaeuser,
    ruf,
    nowMs,
    addVehicle,
    buyVehicle,
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
    erzeugeTestEinsatz,
    alarmieren,
    markiereMeldungGelesen,
    neuesSpiel,
  };
}
