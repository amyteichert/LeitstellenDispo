import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GAME_CONFIG,
  WACHEN_PREISE,
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

  const addVehicle = (v: Omit<Vehicle, 'id'>) => {
    const id = `fahrzeug-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    // Ohne Personalsystem ist jedes neue Fahrzeug voll besetzt (Sollstärke laut Katalog)
    const besatzung = v.besatzung ?? getFahrzeugTyp(v.type)?.besatzung;
    setVehicles((cur) => [...cur, { ...v, id, besatzung, status: v.status ?? 'Einsatzbereit' }]);
  };

  const spielstandAnwenden = (spielstand: Spielstand) => {
    setBalance(spielstand.balance);
    setTransactions(spielstand.transactions);
    setLocations(spielstand.locations);
    setVehicles(spielstand.vehicles);
    setIncidents(spielstand.incidents);
    setCompletedIncidentHistory(spielstand.completedIncidentHistory);
    setKrankenhaeuser(spielstand.krankenhaeuser);
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
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [spielstandGeladen, balance, transactions, locations, vehicles, incidents, completedIncidentHistory, krankenhaeuser]);

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
      setCompletedIncidentHistory((current) => [
        ...ergebnis.abgeschlossen,
        ...current,
      ].slice(0, GAME_CONFIG.completedIncidentHistoryLimit));
      setBalance((cur) => cur + ergebnis.abgeschlossen.reduce((sum, incident) => sum + incident.reward, 0));
      ergebnis.abgeschlossen.forEach((incident) => addTransaction('Einnahme', `${incident.organization} – ${formatEinsatzTitel(incident)} abgeschlossen`, incident.reward));
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
    const earned = completedIncidentHistory.reduce((sum, incident) => sum + incident.reward, 0);
    return { total, rettungsdienst, feuerwehr, earned };
  }, [completedIncidentHistory]);

  // ---- Aktionen ----

  /** Kauft ein Fahrzeug für eine Wache. Gibt eine Fehlermeldung zurück oder null bei Erfolg. */
  const buyVehicle = (stationId: string, typ: string): string | null => {
    const station = locations.find((location) => location.id === stationId && location.type === 'station');
    const fahrzeugTyp = getFahrzeugTyp(typ);
    if (!station || !fahrzeugTyp) return 'Wache oder Fahrzeugtyp nicht gefunden.';
    if (fahrzeugTyp.wachenArt !== (station.stationKind ?? 'Rettungswache')) {
      return `${typ} passt nicht zu einer ${station.stationKind ?? 'Rettungswache'}.`;
    }
    if (balance < fahrzeugTyp.preis) {
      return `Nicht genügend Guthaben. Benötigt: ${fahrzeugTyp.preis} €, verfügbar: ${balance} €.`;
    }

    const nummer = vehicles.filter((vehicle) => vehicle.type === typ).length + 1;
    setBalance((cur) => cur - fahrzeugTyp.preis);
    addTransaction('Ausgabe', `${typ} für ${station.name} gekauft`, fahrzeugTyp.preis);
    addVehicle({
      name: typ,
      type: typ,
      stationId,
      price: fahrzeugTyp.preis,
      callsign: `${typ.replace(/\s+/g, '')}-${nummer}`,
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
      addVehicle({
        name: wache.startFahrzeugTyp,
        type: wache.startFahrzeugTyp,
        stationId: locationId,
        price: vehiclePrice,
        callsign: wache.funkrufname.trim() || `${wache.startFahrzeugTyp} ${Date.now().toString().slice(-4)}`,
      });
    }

    return { id: locationId };
  };

  const loescheWache = (id: string) => {
    setLocations((current) => current.filter((location) => location.id !== id));
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
    nowMs,
    addVehicle,
    buyVehicle,
    erstelleWache,
    loescheWache,
    erzeugeTestEinsatz,
    alarmieren,
    markiereMeldungGelesen,
    neuesSpiel,
  };
}
